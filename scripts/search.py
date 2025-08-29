#!/usr/bin/env python3
"""
Quick CLI search against the local lexical index.

Usage:
  uv run python scripts/search.py --q "featherwing" --limit 5
"""

from __future__ import annotations

import argparse
from typing import Optional

from core import db as coredb


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--q", required=True, help="Query text")
    ap.add_argument("--limit", type=int, default=5, help="Max results")
    args = ap.parse_args(argv)

    try:
        results = coredb.search(args.q, limit=args.limit)
    except Exception as e:
        print(f"Error: {e}")
        return 2
    if not results:
        print("No results.")
        return 0
    for r in results:
        stock = r.stock
        print(f"PID {r.pid} | ${r.price:.2f} | stock={stock} | {r.name}\n  {r.url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
