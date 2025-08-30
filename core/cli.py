from __future__ import annotations

import argparse
import sys
import shlex
import webbrowser
from pathlib import Path
import os
import shutil
import json
from typing import Optional

from core import db as coredb


def _print_results(query: str, limit: int, db_path: Path) -> int:
    try:
        results = coredb.search(query, limit=limit, db_path=db_path)
    except Exception as e:
        print(f"Error: {e}")
        return 2
    if not results:
        print("No results.")
        return 0
    for r in results:
        stock = r.stock
        price = f"${r.price:.2f}" if isinstance(r.price, float) else str(r.price)
        print(f"PID {r.pid} | {price} | stock={stock} | {r.name}\n  {r.url}")
    return 0


def _print_results_json(query: str, limit: int, db_path: Path) -> int:
    try:
        results = coredb.search(query, limit=limit, db_path=db_path)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 2
    payload = [
        {
            "pid": r.pid,
            "name": r.name,
            "price": r.price,
            "stock": r.stock,
            "url": r.url,
            "date_added": r.date_added,
            "discontinue_status": r.discontinue_status,
            "model": r.model,
            "mpn": r.mpn,
            "manufacturer": r.manufacturer,
        }
        for r in (results or [])
    ]
    print(json.dumps(payload))
    return 0


def _is_wsl() -> bool:
    try:
        with open("/proc/sys/kernel/osrelease", "r", encoding="utf-8") as f:
            return "microsoft" in f.read().lower()
    except Exception:
        return False


def _open_url(url: str, no_browser: bool = False) -> int:
    # Always print the URL so users can copy it in headless environments
    print(f"URL: {url}")
    if no_browser or os.environ.get("FRUITFUL_NO_BROWSER") == "1":
        print("Browser opening disabled; copied URL above.")
        return 0
    try:
        # Prefer wslview when running under WSL
        if _is_wsl() and shutil.which("wslview"):
            import webbrowser as wb

            wb.register("wslview", None, wb.BackgroundBrowser("wslview"))
            ok = wb.get("wslview").open(url)
        else:
            ok = webbrowser.open(url, new=2)
        if ok:
            print(f"Opened {url}")
            return 0
        else:
            print("Could not open a browser; copy the URL above.")
            return 1
    except Exception as e:
        print(f"Failed to open browser: {e}. Copy the URL above.")
        return 2


def _open_pid(pid: int, db_path: Path, no_browser: bool = False) -> int:
    # Look up URL for PID from meta table directly to avoid fuzzy matches
    try:
        conn = coredb.open_db(db_path)
    except Exception as e:
        print(f"Error opening DB: {e}")
        return 2
    try:
        row = conn.execute("SELECT url FROM meta WHERE pid = ?", (pid,)).fetchone()
    finally:
        conn.close()
    if not row or not row[0]:
        print(f"No URL found for PID {pid}.")
        return 1
    url = row[0]
    return _open_url(url, no_browser=no_browser)


def _repl(limit: int, db_path: Path, no_browser: bool) -> int:
    print("fruitful-console — type a query, or commands like :help, :open <pid>, :q")
    while True:
        try:
            line = input("fruitful> ")
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        line = line.strip()
        if not line:
            continue
        if line.startswith(":"):
            # Commands: :q, :quit, :help, :open <pid>
            parts = shlex.split(line)
            cmd = parts[0].lower()
            if cmd in (":q", ":quit", ":exit"):
                return 0
            if cmd in (":h", ":help"):
                print(":open <pid> — open product URL in browser")
                print(":q — quit")
                continue
            if cmd == ":open":
                if len(parts) < 2:
                    print("Usage: :open <pid>")
                    continue
                try:
                    pid = int(parts[1])
                except ValueError:
                    print("PID must be an integer.")
                    continue
                _open_pid(pid, db_path, no_browser=no_browser)
                continue
            print(f"Unknown command: {cmd}. Try :help")
            continue
        # Otherwise treat as search query
        _print_results(line, limit=limit, db_path=db_path)


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(prog="fruitful-console", description="Non-TUI console search for Fruitful Search")
    ap.add_argument("query", nargs="*", help="Query text. If omitted, starts an interactive prompt.")
    ap.add_argument("--limit", type=int, default=10, help="Max results to display")
    ap.add_argument(
        "--db",
        type=Path,
        default=coredb.DEFAULT_DB_PATH,
        help=f"Path to lexical SQLite index (default: {coredb.DEFAULT_DB_PATH})",
    )
    ap.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not attempt to open a web browser; just print the URL.",
    )
    ap.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON array for results in single-shot mode (ignored in REPL).",
    )
    args = ap.parse_args(argv)

    # Single-shot mode if a query is provided
    if args.query:
        query = " ".join(args.query).strip()
        if not query:
            return 0
        if query.startswith(":open"):
            # Permit one-shot :open <pid>
            parts = shlex.split(query)
            if len(parts) < 2:
                print("Usage: :open <pid>")
                return 2
            try:
                pid = int(parts[1])
            except ValueError:
                print("PID must be an integer.")
                return 2
            return _open_pid(pid, args.db, no_browser=args.no_browser)
        if args.json:
            return _print_results_json(query, limit=args.limit, db_path=args.db)
        return _print_results(query, limit=args.limit, db_path=args.db)

    # No query args: start REPL
    return _repl(limit=args.limit, db_path=args.db, no_browser=args.no_browser)


if __name__ == "__main__":
    raise SystemExit(main())
