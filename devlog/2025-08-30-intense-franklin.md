## 2025-08-30 — Pitch: intense-franklin

### Status
- Done (2025-08-30 RS)

### Summary

Rethink fruitful-search as a non-TUI console app.
We'll still take user queries and display matching items.
But it all takes place in a simple text console, not a TUI.

### Goals
- [ ] Can answer user queries via console (single-shot and REPL)
- [ ] Support `:open <productId>` to open URL in browser
- [ ] Tests pass (repo-wide), no changes under `./tui`

### Acceptance Criteria
- `uv run fruitful-console "feather i2c"` prints top results, exit code 0
- `uv run fruitful-console` starts interactive prompt; `:open <pid>` opens browser
- No imports from `tui.*`; `./tui` unchanged; offline-only (local SQLite FTS5)

### Out of Scope
- Any changes in ./tui.

### Open Questions
- Add `--json` output for scripting in a follow-up?
- Handle environments without FTS5: friendlier error or raw-name search?
  - Browser opening in headless/WSL shells: handled via `--no-browser`, `FRUITFUL_NO_BROWSER=1`, and WSL `wslview` preference.

### Actions (Development Phase)
- [x] Scaffold non-TUI console app `core/cli.py` (single-shot + REPL)
- [x] Add entrypoint `fruitful-console` in `pyproject.toml`
- [x] Implement `:open <pid>` using `meta` lookup and `webbrowser.open`
- [x] README: add Console (Non‑TUI) Usage section
- [x] Tests: `tests/test_cli.py` covering one-shot query and `:open`
- [x] Optional: add `--json` output flag and test
- [x] Optional: add error-path tests (DB missing, non-integer PID, no URL)
- [ ] Wrap-up: update this devlog with outcomes

### Artifacts
- Code: `core/cli.py`
- Packaging: `pyproject.toml` (added `fruitful-console` script)
- Docs: `README.md` (Console usage)
- Tests: `tests/test_cli.py`

### Repro
- Setup: `uv venv && source .venv/bin/activate`
- Install: `uv pip install -e ".[dev]"`
- Tests: `uv run pytest -q`
- App (smoke): `uv run fruitful-console "feather"` or start REPL with `uv run fruitful-console`

### Notes
- Decisions, tradeoffs, and risks/assumptions.

### Wrap-up
- Outcomes:
  - Implemented non‑TUI console app with single‑shot and REPL modes (`core/cli.py`).
  - Added entrypoint `fruitful-console` in `pyproject.toml`.
  - Implemented `:open <pid>` with URL lookup and robust browser handling (`--no-browser`, `FRUITFUL_NO_BROWSER=1`, WSL `wslview`).
  - Added `--json` output for one‑shot scripting.
  - Updated docs with Console usage and troubleshooting (`README.md`).
  - Added tests for one‑shot results, `:open`, JSON output, and error paths (`tests/test_cli.py`).
  - No changes to `./tui`; existing `fruitful-search` entrypoint remains TUI.
  - Acceptance verified locally via `uv run pytest -q` and console smoke.

- Formatting: `uv run black .` (or `uvx black .`)
- Commit message suggestion:
  - `pitch: intense-franklin — add console CLI (fruitful-console) with :open and --json`
