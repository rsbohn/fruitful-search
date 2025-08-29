# Fruitful Search Agent Guide

This document defines how the Fruitful Search agent behaves, what data it uses, how it ranks and explains results, and the developer runbook to operate and extend it.

## Overview
- Purpose: Help makers find the “missing piece” in the Adafruit ecosystem via fast catalog exploration and friendly guidance.
- Surfaces: Primary TUI (Textual). Future: MCP service, Copilot chat mode, sub‑agent, custom GPT chat app.
- Modes: precise spec search and Inspire (show something cool/in‑stock).

## Capabilities
- Hybrid retrieval: lexical (SQLite FTS5) + semantic (FAISS) with stock‑aware reranking.
- Query parsing: extract specs (channels/bits/voltage/current), interfaces (I2C/SPI/UART), form factors, connectors, price, and stock intent.
- Filters: in‑stock default toggle, price range, form factor, interfaces, connectors, numeric ranges (voltage/current/channels/bits/dimensions).
- Explainability: highlight matches and emit a concise “why it matched” line.
- Substitutes: when the top match is OOS/legacy, surface closest in‑stock alternatives.

## Data Sources
- Primary: Adafruit Products API catalog JSON.
- Secondary: optional small stock/price snapshots (ToS‑permitting) for frequent refresh.
- Optional enrichment: private device registry → synonyms/compatibility/seed queries (derived artifacts only).
- Details: See docs/devlog/2025-08-29-data-source.md

## Compliance & Constraints
- Use official API endpoints (no scraping). Do not hotlink images.
- Throttle calls to ≤ 5/min; cache responses; schedule full refreshes.
- Attribute clearly: include “View on Adafruit” links; image credit; datasheets via product pages.
- Respect ToS and content rights; seek permission for redistribution.
- Checklist: docs/devlog/2025-08-29-compliance.md

## Retrieval & Ranking
- Candidate gen: top‑N BM25 (FTS5) + top‑M embeddings (FAISS).
- Rerank signals: lexical, semantic, spec fit, stock, recency; optional popularity/price preference.
- Defaults: in‑stock boost; legacy/discontinued penalized unless requested.
- Diversity: group variants; avoid near‑duplicates in top results.
- Details & weights: docs/devlog/2025-08-29-ranking-relevance.md

## Query Types & Interpretation
- Intents: spec search, form factor/function, compatibility, budget/stock, inspiration, identifiers (PID/SKU).
- Parsing: normalize units and ranges (≤/≥/between), apply synonyms, handle light misspellings and negation (“without headers”).
- Structured shape: keywords + facets + numerics + stock/price + sort + mode.
- Ambiguity: prompt a quick, non‑blocking clarification when necessary.
- Details: docs/devlog/2025-08-29-query-types.md

## TUI UX Behaviors
- Views: Search, Details, Filters, Compare, Inspire, Help.
- Shortcuts: `/` search, Enter details, `f` filters, `i` in‑stock toggle, `a` compare, `g i` inspire, `?` help, `o` open browser.
- Result cards: name, stock badge, price, key specs, short “why it matched”.
- Accessibility: high‑contrast theme; avoid color‑only cues.
- Details: docs/devlog/2025-08-29-output-ux.md

## Indexes & Storage
- Lexical: SQLite FTS5 DB with basic metadata.
- Semantic: FAISS vectors (optional, added when enabled).
- Data layout: `data/raw/`, `data/processed/`, `indexes/` (all git‑ignored).
- Freshness: weekly rebuild; 15–60 min stock snapshots; incremental upserts where possible.
- System: devlog/2025-08-29-system-design.md

## Developer Runbook
- Env: Python 3.11+, manager: `uv`.
- Setup:
  - `uv venv && source .venv/bin/activate`
  - `uv pip install -e ".[dev]"` then optionally `,[ingest],[index],[tui]`.
  - Copy `config/settings.example.yaml` → `config/settings.yaml` and set paths.
- Data:
  - Download catalog JSON → `data/raw/adafruit_catalog.json` (or via `curl http://www.adafruit.com/api/products`).
  - Ingest (optional parquet): `uv run python scripts/ingest_catalog.py`
  - Build indexes: `uv run python scripts/build_index.py`
  - Refresh stock (stub): `uv run python scripts/refresh_stock.py`
- Private device registry (optional):
  - Set absolute path in `config/settings.yaml` → `external.device_registry_path`.
  - Derive artifacts: `uv run python scripts/derive_from_device_registry.py`
  - Outputs: `config/synonyms.yaml`, `config/compatibility.yaml`, `eval/gold.yaml` (git‑ignored)

## Quality & Evaluation
- Metrics: precision@k (3/5/10), MRR, coverage; optional time‑to‑find from TUI.
- Seed set: 20–50 representative queries with labeled top results.
- Tooling (planned): `eval/run_eval.py` uses `eval/gold.yaml` to compute metrics.
- Process: track scores; prevent regressions; expand gold set as usage grows.
- Doc: docs/devlog/2025-08-29-quality-evaluation.md

## Extensibility
- MCP service: expose search/retrieval as a capability.
- Copilot chat mode: inline ranked results and rationale.
- Sub‑agent: act as a retriever/grounder in a larger toolchain.
- Custom GPT chat app: web chat backed by the same indexes.

## Notes & Limits (MVP)
- Lean mode: works with lexical index only (no pandas/pyarrow/faiss required).
- Semantic rerank & numeric filters: enabled once processed parquet and embeddings are available.
- Compliance guardrails: rate limiting and image caching are caller’s responsibility in non‑TUI integrations.

