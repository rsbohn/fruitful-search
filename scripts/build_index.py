#!/usr/bin/env python3
"""
Build search indexes from the processed catalog.

This is a scaffold:
- Prefer processed parquet; if missing, fall back to raw JSON.
- Creates index directories and a SQLite FTS5 DB if available.
- On raw JSON, indexes name/model/mpn/manufacturer text and stores basic metadata.
- Writes a minimal metadata file.

Usage:
  python scripts/build_index.py \
    --in data/processed/catalog.parquet \
    --out indexes/
  # or rely on fallback to raw JSON path in config/settings.yaml
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime
import json
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


def ensure_fts5(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS __fts5_probe USING fts5(x)")
        conn.execute("DROP TABLE __fts5_probe")
        return True
    except sqlite3.OperationalError:
        return False


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--in",
        dest="in_path",
        type=Path,
        default=None,
        help="Path to processed parquet",
    )
    ap.add_argument(
        "--out", dest="out_dir", type=Path, default=None, help="Indexes output dir"
    )
    args = ap.parse_args(argv)

    in_path = args.in_path or load_settings_path(
        "processed_catalog", "data/processed/catalog.parquet"
    )
    raw_json_path = load_settings_path("raw_catalog", "data/raw/adafruit_catalog.json")
    out_dir = args.out_dir or load_settings_path("indexes_dir", "indexes/")

    use_raw_json = False
    if not in_path.exists():
        if raw_json_path.exists():
            use_raw_json = True
        else:
            print(
                f"Error: neither processed catalog at {in_path} nor raw JSON at {raw_json_path} found.",
                file=sys.stderr,
            )
            print(
                "Run scripts/ingest_catalog.py or download raw JSON.", file=sys.stderr
            )
            return 2

    lexical_dir = out_dir / "lexical"
    semantic_dir = out_dir / "semantic"
    lexical_dir.mkdir(parents=True, exist_ok=True)
    semantic_dir.mkdir(parents=True, exist_ok=True)

    # Create FTS5 DB if supported
    db_path = lexical_dir / "index.sqlite"
    conn = sqlite3.connect(db_path)
    has_fts5 = ensure_fts5(conn)
    if has_fts5:
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(name, model, mpn, manufacturer, extra)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS meta (pid INTEGER PRIMARY KEY, url TEXT, price REAL, stock INTEGER, date_added TEXT, discontinue_status TEXT)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS docs_map (rowid INTEGER PRIMARY KEY, pid INTEGER)"
        )
        # Populate from raw JSON if parquet not present (lean mode)
        if use_raw_json:
            try:
                rows_obj = json.loads(
                    Path(raw_json_path).read_text(encoding="utf-8", errors="replace")
                )
            except Exception as e:
                print(f"Failed to read raw JSON: {e}", file=sys.stderr)
                conn.close()
                return 3
            if isinstance(rows_obj, dict) and "products" in rows_obj:
                rows = rows_obj["products"]
            elif isinstance(rows_obj, list):
                rows = rows_obj
            else:
                rows = []
            cur = conn.cursor()
            count = 0
            for r in rows:
                pid = (
                    int(r.get("product_id", 0))
                    if str(r.get("product_id", "0")).isdigit()
                    else None
                )
                name = r.get("product_name", "")
                model = r.get("product_model", "") or ""
                mpn = r.get("product_mpn", "") or ""
                manuf = r.get("product_manufacturer", "") or ""
                extra_parts = []
                for k in ("product_master_category", "product_image_alt"):
                    v = r.get(k)
                    if v:
                        extra_parts.append(str(v))
                extra = " ".join(extra_parts)
                cur.execute(
                    "INSERT INTO docs(name, model, mpn, manufacturer, extra) VALUES(?,?,?,?,?)",
                    (name, model, mpn, manuf, extra),
                )
                rowid = cur.lastrowid
                if pid is not None:
                    url = r.get("product_url") or ""
                    try:
                        price = float(r.get("product_price", 0) or 0)
                    except Exception:
                        price = 0.0
                    try:
                        stock = int(r.get("product_stock", 0) or 0)
                    except Exception:
                        stock = 0
                    date_added = r.get("date_added") or ""
                    disc = r.get("discontinue_status") or ""
                    cur.execute(
                        "INSERT OR REPLACE INTO meta(pid, url, price, stock, date_added, discontinue_status) VALUES(?,?,?,?,?,?)",
                        (pid, url, price, stock, date_added, disc),
                    )
                    if rowid is not None:
                        cur.execute(
                            "INSERT OR REPLACE INTO docs_map(rowid, pid) VALUES(?,?)",
                            (rowid, pid),
                        )
                count += 1
            conn.commit()
    conn.close()

    # Minimal semantic metadata placeholder
    meta = {
        "built_at": datetime.utcnow().isoformat() + "Z",
        "processed_source": str(in_path if not use_raw_json else raw_json_path),
        "lexical_index": str(db_path),
        "semantic_index": str(semantic_dir / "index.faiss"),
        "fts5_available": has_fts5,
        "populated_from": "raw_json" if use_raw_json else "processed_parquet",
    }
    (out_dir / "METADATA.json").write_text(
        json.dumps(meta, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Indexes scaffolded under {out_dir}")
    if not has_fts5:
        print("Note: SQLite FTS5 not available; lexical index was not created.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
