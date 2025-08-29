# Zero Pitch — Heliotrope Cuddlebear (2025-08-29)

Purpose: A maker-focused assistant for finding the “missing piece” in Adafruit’s catalog. Friendly exploration, precise spec search, and an Inspire mode for discovery. TUI-first, offline-friendly, with clear compliance to Adafruit’s API usage.

What’s in scope now
- Output & UX: Textual-based TUI with Search, Details, Filters, Compare, Inspire, Help. Keyboard-first with explainable matches.
- Data Source: Official catalog JSON primary; stock/price snapshots optional. Offline-first artifacts under `data/` and `indexes/`.
- Filters & Constraints: In‑stock default, interfaces, form factors, connectors, numeric ranges (V/A/ch/bits/mm), budget.
- Ranking & Relevance: Hybrid BM25 + embeddings (later), spec-fit and stock-aware rerank, diversity, explanations.
- Query Types: Spec, form factor/function, compatibility, identifiers, budget/stock, inspiration. Unit normalization and synonyms.
- Compliance: No scraping or image hotlinking; ≤5/min rate; attribution; ToS respected.

What we shipped in this pass
- README scaffolded with finalized sections (no TBDs), plus “Attribution & Usage”.
- Devlogs for purpose/users, data source, output/ux, filters/constraints, ranking/relevance, query types, logistics, compliance, quality.
- AGENTS.md: agent behavior, retrieval/ranking, UX, runbook, and guardrails.
- Scripts (lean):
  - `scripts/ingest_catalog.py` (optional parquet via pandas/pyarrow)
  - `scripts/build_index.py` (builds SQLite FTS5 lexical index; raw JSON fallback)
  - `scripts/refresh_stock.py` (stub)
  - `scripts/derive_from_device_registry.py` (generates synonyms, compatibility, eval seeds)
- pyproject.toml with optional extras; `uv` chosen for env and installs.
- Downloaded catalog JSON and built lexical index directly from raw JSON (FTS5 `docs` + `meta`).

What’s next (MVP track)
- Minimal search CLI or TUI skeleton wired to FTS5.
- Synonyms/compatibility usage in query parsing.
- Optional: parquet ingest and semantic rerank when ready.
