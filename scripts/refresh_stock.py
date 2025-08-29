#!/usr/bin/env python3
"""
Refresh stock/price metadata (stub).

This script will, in the future, download a small stock/price snapshot and
update metadata without rebuilding indexes. For now, it provides a placeholder
CLI and prints where snapshots would be stored.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional


def load_settings_path(key: str, default: str) -> Path:
    settings = Path("config/settings.yaml")
    if not settings.exists():
        return Path(default)
    text = settings.read_text(encoding="utf-8", errors="replace")
    value = None
    for line in text.splitlines():
        if line.strip().startswith(f"{key}:"):
            value = line.split(":", 1)[1].strip().strip("'\"")
            break
    return Path(value) if value else Path(default)


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", dest="out_path", type=Path, default=None,
                    help="Path to write stock snapshot (JSON)")
    args = ap.parse_args(argv)

    default_out = Path("data/processed/stock_snapshot.json")
    out_path = args.out_path or default_out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[stub] Would refresh stock/price and write snapshot to: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

