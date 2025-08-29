# Pitch 1 — Minimal TUI Skeleton (2025-08-29)

Status: Agreed (Phase 1 — Alignment complete on 2025-08-29, RS)

## Summary
Build a minimal, fast Textual-based Terminal UI that searches the local lexical (SQLite FTS5) index and displays results with essential metadata. This establishes the interactive baseline to iterate on UX, filters, and ranking.

## Goals (measurable)
- Launch: `python -m tui` starts the app and renders without errors.
- Search: typing a query and pressing Enter shows top 20 FTS5 matches.
- Results: each row shows PID, name, price, and stock badge.
- Details: selection shows a right-pane with URL, price, stock, date_added, discontinue_status, and basic fields (model/mpn/manufacturer) when available.
- Keyboard: `/` focus search, `Enter` execute search, `↑/↓` navigate, `Esc` clear selection, `o` opens product URL in browser.
- Offline: all interactions use local `indexes/lexical/index.sqlite`; no network calls during runtime.

## Acceptance Criteria
- Works against the existing `indexes/lexical/index.sqlite` produced by `scripts/build_index.py` (raw JSON fallback).
- Handles empty/short queries gracefully and shows an initial hint when no query.
- No hard crash if FTS5 is unavailable; show a friendly error with next steps.
- Clean exit on `Ctrl+C` or `q`.

## Out of Scope (for this pitch)
- Semantic embeddings or reranking.
- Numeric/spec filters, facets UI, compare, Inspire view.
- Images/thumbnails and link previews.
- Stock/price refresh or online updates.
- Packaging/distribution beyond `python -m tui` entrypoint.

## Open Questions
- Windows keybindings parity (confirm `o` open works cross‑platform).
- Path discovery if `indexes/` is missing (prompt to run build script?).
- Result count and pagination (start with 20 fixed; revisit later).

## Notes
- Code lives under `tui/` package with app, views, and a small DB access helper that reads from the `meta` and `docs` tables.
- Keeps dependencies lean (only `textual`/`rich` via `[tui]` extra).
