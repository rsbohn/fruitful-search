from __future__ import annotations

import sqlite3
from dataclasses import dataclass
import re
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


def _sanitize_for_fts(query: str) -> list[str]:
    # Keep simple alphanumerics; drop punctuation that confuses MATCH
    tokens = re.findall(r"[0-9A-Za-z]+", query)
    return tokens


def search(
    query: str, limit: int = 20, db_path: Path = DEFAULT_DB_PATH
) -> List[Result]:
    if not db_path.exists():
        raise FileNotFoundError(f"Lexical index not found at {db_path}")
    conn = open_db(db_path)
    try:
        if not has_fts5(conn):
            raise RuntimeError("SQLite FTS5 not available in this environment.")
        q = query.strip()
        tokens = _sanitize_for_fts(q)
        if not tokens:
            return []
        # Basic BM25-ordered match across all columns
        # Note: bm25() requires the actual FTS5 table name, not the alias
        sql = (
            "SELECT m.pid, d.name, m.price, m.stock, m.url, m.date_added, m.discontinue_status, "
            "d.model, d.mpn, d.manufacturer, bm25(docs) AS score "
            "FROM docs d JOIN docs_map dm ON dm.rowid = d.rowid "
            "JOIN meta m ON m.pid = dm.pid "
            "WHERE docs MATCH ? ORDER BY score LIMIT ?"
        )
        match_query = " ".join(tokens)  # space acts like AND in FTS5
        try:
            rows = conn.execute(sql, (match_query, limit)).fetchall()
        except sqlite3.OperationalError:
            # Fallback: quote each token and OR them, to avoid syntax issues
            match_query = " OR ".join(f'"{t}"' for t in tokens)
            rows = conn.execute(sql, (match_query, limit)).fetchall()
        results: List[Result] = []
        for (
            pid,
            name,
            price,
            stock,
            url,
            date_added,
            disc,
            model,
            mpn,
            manufacturer,
            _score,
        ) in rows:
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
