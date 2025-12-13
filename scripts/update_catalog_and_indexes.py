#!/usr/bin/env python3
"""
One-step helper to refresh the local catalog and rebuild indexes.

Steps:
- Download the Adafruit catalog JSON (writes to data/raw/adafruit_catalog.json).
- Ingest/validate and optionally write parquet (scripts/ingest_catalog.py).
- Rebuild indexes (scripts/build_index.py).
- Optionally run the stock refresher stub (scripts/refresh_stock.py).

Usage:
  python scripts/update_catalog_and_indexes.py
    --skip-download   # reuse existing raw JSON
    --skip-refresh    # skip the stock refresher stub
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List


def run_step(cmd: Iterable[str], label: str) -> None:
    """Run a subprocess and exit immediately if it fails."""
    print(f"==> {label}")
    proc = subprocess.run(list(cmd))
    if proc.returncode != 0:
        print(f"Step failed ({label}) with exit code {proc.returncode}", file=sys.stderr)
        sys.exit(proc.returncode)


def main(argv: List[str] | None = None) -> int:
    repo_root = Path(__file__).resolve().parent.parent
    scripts_dir = repo_root / "scripts"

    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--skip-download",
        action="store_true",
        help="Do not fetch the catalog JSON (reuse existing file).",
    )
    ap.add_argument(
        "--skip-refresh",
        action="store_true",
        help="Skip the stock/price refresher stub.",
    )
    args = ap.parse_args(argv)

    steps = []
    if not args.skip_download:
        steps.append(
            ([sys.executable, str(scripts_dir / "download_adafruit_catalog.py")], "Download catalog JSON")
        )
    steps.extend(
        [
            ([sys.executable, str(scripts_dir / "ingest_catalog.py")], "Ingest catalog (validate + parquet if deps installed)"),
            ([sys.executable, str(scripts_dir / "build_index.py")], "Rebuild indexes"),
        ]
    )
    if not args.skip_refresh:
        steps.append(
            ([sys.executable, str(scripts_dir / "refresh_stock.py")], "Refresh stock/price metadata (stub)")
        )

    for cmd, label in steps:
        run_step(cmd, label)

    print("All steps completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
