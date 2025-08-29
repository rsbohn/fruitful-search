# Fruitful Search

An assistant to help makers find the “missing piece” in the Adafruit ecosystem — fast, friendly catalog exploration with both precise spec search and inspiration mode.

## Purpose & Users
- Users: makers/hobbyists seeking components to complete a project.
- Goals: quick discovery with helpful explanations and light conversation.
- Modes: specific spec search (e.g., “eight channel six bit A/D”) and “show me something cool”.
- Stock: default in‑stock; allow out‑of‑stock (OOS) on request with clear labeling and substitutes.

## Data Source
- Primary: Adafruit catalog JSON as the canonical corpus.
- Secondary: small stock/price snapshot from live feeds (if ToS permits).
- Offline‑first: local artifacts power search; refresh runs in background.
- Artifacts (planned):
  - Raw: `data/raw/adafruit_catalog.json`
  - Processed: `data/processed/catalog.parquet`
  - Indexes: `indexes/lexical/` (SQLite FTS5) and `indexes/semantic/` (FAISS)

## Query Types
- Spec search: numeric/technical constraints (e.g., “8‑channel 6‑bit ADC”, “USB‑C PD 12V”).
- Form factor & function: “Feather with BLE and LiPo”, “±16g accelerometer”.
- Compatibility: accessories “for Feather/QT Py/Metro”, basic rule‑based mapping.
- Budget & stock: “under $10”, “in stock only”, “include out of stock”.
- Inspiration: “show me something cool/new/popular” → Inspire view.
- Identifiers: PID/SKU/slug direct lookup.
- Parsing: normalize units/ranges, handle operators (≤/≥/between), synonyms, light fuzziness, and negation (“without headers”).

## Filters & Constraints
- Stock: in‑stock (default ON) with toggle to include OOS; optional legacy/discontinued visibility.
- Price: min/max slider with simple presets ($/$$/$$$).
- Form factor: Feather, FeatherWing, QT Py, ItsyBitsy, Trinket, Breakout, Metro.
- Interfaces: I2C, SPI, UART, USB, CAN, GPIO, PWM, ADC, DAC.
- Connectors: STEMMA QT/Qwiic, STEMMA, JST‑PH/SH, headers, terminal blocks, USB‑C/Micro‑B.
- Numeric ranges: voltage input (V), current (mA/A), channels, resolution (bits), dimensions (mm).
- Behavior: hard filters with smart suggestions when empty; optional ±10% soft expansion; facet counts and quick clear.

## Ranking & Relevance
- Hybrid: merge candidates from BM25 (FTS5) and semantic embeddings, then rerank.
- Signals: lexical score, semantic similarity, spec fit (channels/bits/voltage/etc.), stock state, recency, optional popularity/price preference.
- Defaults: in‑stock boost; legacy/discontinued penalized unless explicitly included.
- Explainability: highlight matched terms; show a short “why it matched” line and spec distance if approximate.
- Diversity: group variants and avoid near‑duplicates in the top results; surface in‑stock substitutes when the top match is OOS.
- Tuning: evaluate on a seed query set (precision@k, MRR); consider learning‑to‑rank later.

## Output & UX
- Interface: Terminal UI (TUI) built with Textual; keyboard‑first with discoverable shortcuts.
- Views: Search, Details, Filters, Compare, and Inspire (cool in‑stock picks).
- Result cards: name, stock badge, price, key specs, and a short "why it matched" line.
- Clarification: lightweight prompts to refine ambiguous queries.
- Accessibility: high‑contrast theme and readable defaults.
- Future surfaces: MCP service, Copilot chat mode, sub‑agent, and custom GPT chat app.

## System Design
- Architecture: offline‑first local search with two indexes — SQLite FTS5 (lexical) and FAISS (semantic) — consumed by a Textual TUI.
- Components: ingestion → processed parquet → index builder → search core → TUI; background stock/price refresher.
- Retrieval: hybrid BM25 + embedding candidates, facet filters (in‑stock default), rerank with stock/spec signals, explain matches.
- Freshness: weekly full rebuild; 15–60 min stock snapshot updates without re‑embedding; incremental upserts where possible.
- Storage: `data/raw/`, `data/processed/`, `indexes/` (all git‑ignored).
- Endpoints: use Adafruit API for catalog/stock when ToS allows; rate‑limited and cached.

## Freshness
- Full rebuild on catalog updates (e.g., weekly).
- Frequent lightweight stock/price refresh without re‑embedding.

## Compliance
- Use the official API; do not scrape web pages.
- No image hotlinking: cache/download images locally or via your CDN.
- Throttle API calls to ≤ 5/min; cache responses and schedule refreshes.
- Attribution: include a “View on Adafruit” link, image credit, and link datasheets via product pages.
- Respect Adafruit ToS; seek permission for significant redistribution of content/images.
- See docs/devlog/2025-08-29-compliance.md for the full checklist and links.

## Attribution & Usage
- Product link: include a visible “View on Adafruit” link using each item’s `product_url`.
- Images: do not hotlink; cache locally (e.g., `assets/cache/`) or via your CDN and show “Product image © Adafruit Industries”.
- Datasheets: link to datasheets via the Adafruit product page rather than re-hosting.
- Rate limiting: cap API requests at ≤ 5/min and cache whole responses; schedule refreshes.
- Credits: add a site-wide note such as “Product data and images sourced from Adafruit Industries’ Products API. © Adafruit Industries.”

## Quality & Evaluation
- Metrics: precision@k (3/5/10), MRR, coverage; optional time‑to‑find from TUI.
- Datasets: 20–50 seed queries with labeled ideal results; include ambiguous cases for clarification flow.
- Process: offline eval script over current indexes; track metrics and prevent regressions.
- Feedback: optional in‑TUI thumbs up/down to collect judgments.
- External seed data: can reference a private device registry via a local path; derive non‑sensitive artifacts only.
- See docs/devlog/2025-08-29-quality-evaluation.md for details.

## Project Logistics
- Runtime: Python 3.11+ on Linux/macOS (Windows supported for TUI).
- Packaging: PEP 621 `pyproject.toml` with optional extras (`tui`, `index`, `ingest`, `dev`).
- Dependency manager: `uv` (chosen) — fast installs and `uv run` for commands.
- Dependencies: start lexical‑only (SQLite FTS5); add FAISS/Numpy for semantic as an optional extra; Pandas+PyArrow for ingestion.
- Tooling: ruff (lint), black (format), mypy (types), pytest (tests).
- Layout: `core/`, `tui/`, `scripts/`, `config/`, `data/` (git‑ignored), `indexes/` (git‑ignored), `assets/cache/` (git‑ignored), `docs/devlog/`.
- Scripts: `scripts/ingest_catalog.py`, `scripts/build_index.py`, `scripts/refresh_stock.py`; run TUI via `python -m tui`.
- CI (optional): GitHub Actions for lint/type/test on 3.11/3.12.

## Repo Layout
- Devlogs: `docs/devlog/` (e.g., backgrounders and decisions)
- Data (git‑ignored): `data/raw/`, `data/tmp/`, `data/cache/`
- Indexes (git‑ignored): `indexes/`

## Getting Started (dev)
- Prereqs: Python 3.11+ recommended.
- Copy `config/settings.example.yaml` to `config/settings.yaml` and set paths.
- Place the catalog JSON at `data/raw/adafruit_catalog.json`.
- Create venv with uv: `uv venv && source .venv/bin/activate` (or `Scripts\activate` on Windows).
- Install extras (optional): `uv pip install -e ".[dev,ingest,index,tui]"`.
- Scripts:
  - `scripts/ingest_catalog.py` → validates raw JSON; if Pandas+PyArrow available, writes `data/processed/catalog.parquet`.
  - `scripts/build_index.py` → scaffolds `indexes/` (creates a placeholder SQLite FTS5 DB if available).
  - `scripts/refresh_stock.py` → stub for future stock/price metadata updates.
  - `scripts/derive_from_device_registry.py` → generate `config/synonyms.yaml`, `config/compatibility.yaml`, and `eval/gold.yaml` from a private registry

## Using a Private Device Registry (optional)
- Set an absolute path in `config/settings.yaml` → `external.device_registry_path`, or pass `--registry` on the CLI.
- Run: `python scripts/derive_from_device_registry.py --registry /abs/path/to/device_registry.md`
- Outputs:
  - `config/synonyms.yaml` and `config/compatibility.yaml` (review and commit if desired)
  - `eval/gold.yaml` (ignored by git) for local quality evaluation

## Status
- Early definition phase. See `docs/devlog/` for context:
  - Purpose & Users: `docs/devlog/2025-08-29-backgrounder.md`
  - Data Source: `docs/devlog/2025-08-29-data-source.md`
