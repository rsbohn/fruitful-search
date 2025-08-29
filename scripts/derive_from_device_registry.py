#!/usr/bin/env python3
"""
Derive non-sensitive artifacts (synonyms, compatibility, seed eval queries)
from a private device registry file (e.g., Markdown) without committing the source.

Usage examples:

  python scripts/derive_from_device_registry.py \
    --registry /absolute/path/to/device_registry.md \
    --out-config config \
    --out-eval eval

If --registry is omitted, attempts to read config/settings.yaml for
external.device_registry_path.

Outputs (created if missing):
  - {out_config}/synonyms.yaml
  - {out_config}/compatibility.yaml
  - {out_eval}/gold.yaml

Notes:
  - Pure stdlib; YAML is written as plain text.
  - Parsing is heuristic and safe-by-default. Review outputs before committing.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


HEADER_PATTERN = re.compile(r"^###\s+(?P<name>.+?)\s*\(SN:.*\)$")
PID_PATTERN = re.compile(r"Adafruit Product ID:\s*(?P<pid>\d+)")


@dataclass
class Device:
    name: str
    pids: List[str] = field(default_factory=list)  # all PIDs seen in the section
    host_pid: Optional[str] = None  # first hardware/product PID observed
    terms: Set[str] = field(default_factory=set)  # keywords gleaned from text


CANONICAL_TERMS = {
    # common product/tech aliases we expect to see
    "e-ink": {"epd", "e ink", "e-paper", "e paper"},
    "ili9341": {"ili 9341"},
    "reverse tft": {"reverse-tft", "reverse display"},
    "qualia": set(),
    "feather": {"feather board"},
    "featherwing": {"feather wing"},
    "qt py": {"qtpy"},
}

TERM_HINTS = {
    # quick regex-based hints → canonical term
    re.compile(r"\b(epd|e-?ink|e-?paper)\b", re.I): "e-ink",
    re.compile(r"\bili\s*9341\b", re.I): "ili9341",
    re.compile(r"\breverse\s+tft\b", re.I): "reverse tft",
    re.compile(r"\bqualia\b", re.I): "qualia",
    re.compile(r"\bfeather\b", re.I): "feather",
    re.compile(r"\bfeather\s*wing|featherwing\b", re.I): "featherwing",
    re.compile(r"\bqt\s*py\b", re.I): "qt py",
    re.compile(r"\bstemma\s*qt|qwiic\b", re.I): "stemma qt",
    re.compile(r"\bili9341\b", re.I): "ili9341",
}


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")


def load_registry_path_from_settings() -> Optional[Path]:
    """Best-effort loader for config/settings.yaml external.device_registry_path.

    Avoids YAML dependency; uses simple regex.
    """
    settings = Path("config/settings.yaml")
    if not settings.exists():
        return None
    text = read_text(settings)
    m = re.search(r"device_registry_path\s*:\s*(.+)", text)
    if not m:
        return None
    raw = m.group(1).strip()
    # remove quotes if present
    raw = raw.strip("'\"")
    if not raw:
        return None
    p = Path(raw)
    return p if p.exists() else None


def parse_registry_md(text: str) -> List[Device]:
    devices: List[Device] = []
    current: Optional[Device] = None
    for line in text.splitlines():
        h = HEADER_PATTERN.match(line.strip())
        if h:
            if current:
                devices.append(current)
            current = Device(name=h.group("name").strip())
            continue
        if not current:
            continue
        # PIDs
        for pid_m in PID_PATTERN.finditer(line):
            pid = pid_m.group("pid")
            if pid not in current.pids:
                current.pids.append(pid)
            if current.host_pid is None:
                current.host_pid = pid
        # Terms
        for rx, canon in TERM_HINTS.items():
            if rx.search(line):
                current.terms.add(canon)
    if current:
        devices.append(current)
    return devices


def build_compatibility(devs: List[Device]) -> Dict[str, List[str]]:
    compat: Dict[str, Set[str]] = {}
    for d in devs:
        if not d.host_pid:
            continue
        acc = compat.setdefault(d.host_pid, set())
        for pid in d.pids:
            if pid != d.host_pid:
                acc.add(pid)
    return {k: sorted(v) for k, v in compat.items()}


def build_synonyms(devs: List[Device]) -> Dict[str, List[str]]:
    """Collate observed terms into a simple synonyms list.

    Output format:
      synonyms:
        - canonical: "e-ink"
          terms: ["epd", "e ink", "e-paper"]
    """
    observed: Set[str] = set()
    for d in devs:
        observed |= d.terms
    # seed from CANONICAL_TERMS, include only those observed
    entries: List[Tuple[str, List[str]]] = []
    for canonical, terms in CANONICAL_TERMS.items():
        if canonical in observed or any(t in observed for t in terms):
            entries.append((canonical, sorted(terms)))
    return {"synonyms": [{"canonical": c, "terms": t} for c, t in entries]}


def build_seed_queries(devs: List[Device], compat: Dict[str, List[str]]) -> List[Dict[str, object]]:
    """Create a few plausible queries tied to observed devices.

    Output items:
      - query: "..."
        expected_pids: ["5691", "4446"]
        notes: "..."
    """
    seeds: List[Dict[str, object]] = []
    for d in devs:
        if not d.host_pid:
            continue
        exp = compat.get(d.host_pid, [])
        # Basic host query
        seeds.append(
            {
                "query": f"{d.name}",
                "expected_pids": [d.host_pid],
                "notes": "Host board lookup",
            }
        )
        # Accessory/expansion query
        if exp:
            seeds.append(
                {
                    "query": f"accessories for {d.name}",
                    "expected_pids": exp,
                    "notes": "Accessories/expansions derived from registry",
                }
            )
        # Term-based query
        if d.terms:
            term = sorted(d.terms)[0]
            seeds.append(
                {
                    "query": f"{term} for {d.name}",
                    "expected_pids": [d.host_pid] + exp[:3],
                    "notes": "Feature term + host",
                }
            )
    return seeds


def write_yaml_lines(path: Path, lines: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def dump_synonyms_yaml(syn: Dict[str, List[Dict[str, object]]]) -> List[str]:
    lines = ["# Derived from device registry", "synonyms:"]
    for entry in syn.get("synonyms", []):
        canon = entry.get("canonical", "")
        terms = entry.get("terms", [])
        lines.append(f"  - canonical: {canon}")
        if terms:
            lines.append("    terms:")
            for t in terms:
                lines.append(f"      - {t}")
    return lines


def dump_compat_yaml(compat: Dict[str, List[str]]) -> List[str]:
    lines = ["# Derived from device registry", "compatibility:"]
    for host, acc in sorted(compat.items(), key=lambda kv: int(kv[0])):
        lines.append(f"  {host}:")
        for pid in acc:
            lines.append(f"    - {pid}")
    return lines


def dump_gold_yaml(seeds: List[Dict[str, object]]) -> List[str]:
    lines = ["# Seed queries derived from device registry", "queries:"]
    for item in seeds:
        q = str(item.get("query", "")).replace("\n", " ").strip()
        ex = item.get("expected_pids", [])
        notes = str(item.get("notes", "")).replace("\n", " ").strip()
        lines.append(f"  - query: {q}")
        lines.append("    expected_pids:")
        for pid in ex:
            lines.append(f"      - {pid}")
        if notes:
            lines.append(f"    notes: {notes}")
    return lines


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--registry", type=str, help="Path to device registry (Markdown)")
    ap.add_argument("--out-config", type=str, default="config", help="Output config dir")
    ap.add_argument("--out-eval", type=str, default="eval", help="Output eval dir")
    args = ap.parse_args(argv)

    reg_path = Path(args.registry) if args.registry else load_registry_path_from_settings()
    if not reg_path or not reg_path.exists():
        print("Error: device registry path not provided or does not exist.", file=sys.stderr)
        print("  Pass --registry /abs/path/to/device_registry.md or set config/settings.yaml -> external.device_registry_path", file=sys.stderr)
        return 2

    text = read_text(reg_path)
    devices = parse_registry_md(text)
    if not devices:
        print("Warning: no devices parsed; outputs will be minimal.", file=sys.stderr)

    compat = build_compatibility(devices)
    synonyms = build_synonyms(devices)
    seeds = build_seed_queries(devices, compat)

    out_config = Path(args.out_config)
    out_eval = Path(args.out_eval)

    write_yaml_lines(out_config / "synonyms.yaml", dump_synonyms_yaml(synonyms))
    write_yaml_lines(out_config / "compatibility.yaml", dump_compat_yaml(compat))
    write_yaml_lines(out_eval / "gold.yaml", dump_gold_yaml(seeds))

    print(f"Wrote: {out_config/'synonyms.yaml'}")
    print(f"Wrote: {out_config/'compatibility.yaml'}")
    print(f"Wrote: {out_eval/'gold.yaml'} (ignored by git)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

