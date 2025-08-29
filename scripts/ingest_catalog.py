#!/usr/bin/env python3
"""
Ingest the Adafruit catalog JSON and (optionally) write a processed Parquet file.

This is a scaffold:
- Validates input paths from config or CLI.
- If Pandas+PyArrow are available, writes `data/processed/catalog.parquet`.
- Otherwise, prints instructions and exits.

Usage:
  python scripts/ingest_catalog.py \
    --in data/raw/adafruit_catalog.json \
    --out data/processed/catalog.parquet
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional


def load_settings_path(key: str, default: str) -> Path:
    settings = Path("config/settings.yaml")
    if not settings.exists():
        return Path(default)
    text = settings.read_text(encoding="utf-8", errors="replace")
    # naive parse: look for lines like `raw_catalog: path`
    value: Optional[str] = None
    for line in text.splitlines():
        if line.strip().startswith(f"{key}:"):
            value = line.split(":", 1)[1].strip().strip("'\"")
            break
    return Path(value) if value else Path(default)


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", type=Path,
                    default=None, help="Path to raw catalog JSON")
    ap.add_argument("--out", dest="out_path", type=Path,
                    default=None, help="Path to processed parquet output")
    args = ap.parse_args(argv)

    in_path = args.in_path or load_settings_path("raw_catalog", "data/raw/adafruit_catalog.json")
    out_path = args.out_path or load_settings_path("processed_catalog", "data/processed/catalog.parquet")

    if not in_path.exists():
        print(f"Error: raw catalog not found at {in_path}", file=sys.stderr)
        print("Place the file there or pass --in <path>.", file=sys.stderr)
        return 2

    # Try optional dependencies
    try:
        import pandas as pd  # type: ignore
    except Exception:
        pd = None  # type: ignore
    try:
        import pyarrow  # noqa: F401
    except Exception:
        pyarrow = None  # type: ignore

    if not pd:
        print("Pandas not installed. Install pandas+pyarrow to write parquet.")
        print("  pip install pandas pyarrow")
        return 0
    if not pyarrow:
        print("PyArrow not installed. Install pyarrow to write parquet.")
        print("  pip install pyarrow")
        return 0

    # Load JSON (expects an array or an object with 'products')
    text = in_path.read_text(encoding="utf-8", errors="replace")
    try:
        obj = json.loads(text)
    except Exception as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        return 3

    if isinstance(obj, dict):
        if "products" in obj and isinstance(obj["products"], list):
            rows = obj["products"]
        else:
            print("Unsupported JSON structure: expected top-level array or {products: [...]}.", file=sys.stderr)
            return 3
    elif isinstance(obj, list):
        rows = obj
    else:
        print("Unsupported JSON structure.", file=sys.stderr)
        return 3

    df = pd.DataFrame(rows)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        df.to_parquet(out_path)
    except Exception as e:
        print(f"Failed to write parquet: {e}", file=sys.stderr)
        return 4

    print(f"Wrote processed parquet to {out_path} with {len(df)} rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

