2025-08-29 System Design

This devlog captures the high‑level architecture, core components, and how the Adafruit API endpoints fit into ingestion and freshness.

API endpoints (reference):

- Complete list of products:
  http://www.adafruit.com/api/products

- Complete list of categories:
  http://www.adafruit.com/api/categories

- Specific product details:
  http://www.adafruit.com/api/product/[pid]
  Replace [pid] with the specific product ID (e.g., 998 for Raspberry Pi Model B).

- Specific category details:
  http://www.adafruit.com/api/category/[cid]
  Replace [cid] with the category ID (e.g., 118 for Lasers).

Note: Respect Adafruit’s ToS and rate limits; prefer official exports when available. Operate offline‑first with local artifacts and run refreshes opportunistically.

Overview
--------

- Core: local search engine built on a processed catalog with two indexes:
  - Lexical: SQLite FTS5 for fast BM25 keyword search.
  - Semantic: FAISS (or similar) vectors from name + description + key specs.
- App: TUI (Textual) consuming a search API defined in `core/`.
- Freshness: small, frequent stock/price updates without full re‑embedding; periodic full re‑ingestion.

Components
----------

- Ingestion (`scripts/ingest_catalog.py`):
  - Input: catalog JSON (export or `/api/products` paginated pulls when allowed).
  - Normalize: text cleanup, unit parsing, spec extraction, facets.
  - Output: `data/processed/catalog.parquet` with a stable schema.

- Index builder (`scripts/build_index.py`):
  - Builds FTS5 tables and FAISS index from processed parquet.
  - Persists doc store with metadata for filtering and display.

- Stock/price refresher (`scripts/refresh_stock.py`):
  - Lightweight poll of stock/price (via official feed or per‑product API if permitted).
  - Writes `data/processed/stock_snapshot.json` and updates metadata tables.

- Search core (`core/`):
  - Query parsing: normalize units, extract candidates for facets.
  - Retrieval: hybrid BM25 + semantic candidates; filter by facets (default in‑stock).
  - Rerank: combine lexical, semantic, and stock/recency signals.
  - Explain: surface matched specs/terms for each result.

- TUI (`tui/`):
  - Views: Search, Details, Filters, Compare, Inspire, Help.
  - Background tasks: non‑blocking search; live updates when stock snapshot changes.

Data Flow
---------

1. Download catalog JSON → `data/raw/adafruit_catalog.json`.
2. Ingest → `data/processed/catalog.parquet` (+ artifacts: synonyms, units tables).
3. Build indexes → `indexes/lexical/*.sqlite`, `indexes/semantic/*.faiss` (+ metadata store).
4. Run TUI → queries call `core.search()`; results come with explanations and facets.
5. Periodically refresh stock → update metadata; TUI reflects changes without rebuild.

Indexing Details
----------------

- FTS5: store tokenized `name`, `short_description`, `description`, `tags`, `categories`.
- Vectors: sentence‑level embeddings of name + condensed specs; keep docids aligned.
- Metadata: numeric fields (voltage, current, channels, bits), categorical facets (form_factor, interface, connectors), stock flags.

Search Pipeline
---------------

1. Preprocess query: tokenize, unit normalization (e.g., “3V3” → 3.3V), extract numeric constraints.
2. Candidate generation: top‑N FTS5 + top‑M FAISS.
3. Merge & filter: apply in‑stock default, respect requested facets.
4. Rerank: weighted blend of lexical score, vector similarity, spec proximity, stock state, price if relevant.
5. Explain: list matched attributes and highlight terms in snippets.

Freshness & Scheduling
----------------------

- Full rebuild weekly or on catalog change.
- Stock snapshot every 15–60 minutes where permitted; backoff on errors/rate limits.
- Incremental updates: upsert changed docids; remove discontinued.

Storage Layout
--------------

- `data/raw/`          raw catalog JSON (git‑ignored)
- `data/processed/`    parquet + stock snapshot (git‑ignored)
- `indexes/`           FTS5 DB + FAISS files (git‑ignored)

Configuration
-------------

- `config/settings.yaml` (planned): paths, feature flags, refresh cadence, online/offline mode, ToS acknowledgment.

Operational Notes
-----------------

- Offline‑first; degrade gracefully when network is unavailable.
- Rate limit API requests; identify client; cache responses.
- Log ingestion/refresh metrics; surface status in TUI status bar.

Open Questions
--------------

- Confirm official schema and any authenticated feeds.
- Embedding model choice (local vs API) and size.
- How to mark legacy/low‑probability restock in source data.
