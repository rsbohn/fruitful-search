from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional


DEFAULT_DB_PATH = Path("indexes/lexical/index.sqlite")


@dataclass
class Result:
    pid: int
    name: str
    price: float
    stock: int | str
    url: str
    date_added: str
    discontinue_status: str
    model: str
    mpn: str
    manufacturer: str


def _coerce_int(value) -> int:
    try:
        return int(value)
    except Exception:
        try:
            return int(float(value))
        except Exception:
            return 0


def open_db(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    return sqlite3.connect(db_path)


def has_fts5(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS __probe USING fts5(x)")
        conn.execute("DROP TABLE __probe")
        return True
    except sqlite3.OperationalError:
        return False


def search(query: str, limit: int = 20, db_path: Path = DEFAULT_DB_PATH) -> List[Result]:
    if not db_path.exists():
        raise FileNotFoundError(f"Lexical index not found at {db_path}")
    conn = open_db(db_path)
    try:
        if not has_fts5(conn):
            raise RuntimeError("SQLite FTS5 not available in this environment.")
        q = query.strip()
        if not q:
            return []
        # Basic BM25-ordered match across all columns
        sql = (
            "SELECT m.pid, d.name, m.price, m.stock, m.url, m.date_added, m.discontinue_status, "
            "d.model, d.mpn, d.manufacturer, bm25(d) AS score "
            "FROM docs d JOIN docs_map dm ON dm.rowid = d.rowid "
            "JOIN meta m ON m.pid = dm.pid "
            "WHERE d MATCH ? ORDER BY score LIMIT ?"
        )
        rows = conn.execute(sql, (q, limit)).fetchall()
        results: List[Result] = []
        for (pid, name, price, stock, url, date_added, disc, model, mpn, manufacturer, _score) in rows:
            # Some feeds may use 'in stock' strings; keep as-is if not int
            stock_val: int | str
            try:
                stock_val = _coerce_int(stock)
            except Exception:
                stock_val = stock
            results.append(
                Result(
                    pid=int(pid),
                    name=name or "",
                    price=float(price or 0.0),
                    stock=stock_val,
                    url=url or "",
                    date_added=date_added or "",
                    discontinue_status=disc or "",
                    model=model or "",
                    mpn=mpn or "",
                    manufacturer=manufacturer or "",
                )
            )
        return results
    finally:
        conn.close()

