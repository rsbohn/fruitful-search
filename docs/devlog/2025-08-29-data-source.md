# Data Source

This note defines where product data comes from, how we ingest it, how we keep it fresh, and what we persist for search.

## Sources
- Primary: Adafruit catalog JSON (large, canonical content for products/descriptions/specs/images/categories).
- Secondary: Live website endpoints or feeds for fast‑changing fields (stock, price). Use only if ToS permits.
- Optional: Guides/learn.adafruit.com metadata for enrichment (keywords, projects, tags) if allowed.

## Recommendation
- Use the catalog JSON as the authoritative product corpus for indexing and semantic search.
- Maintain a small “stock snapshot” artifact (JSON/CSV) refreshed periodically to update availability and price without rebuilding the full index.
- Operate in offline‑first mode: search works from local artifacts; network refresh is a background step.

## Artifacts & Layout
- Raw: `data/raw/adafruit_catalog.json` (and optional `data/raw/stock_snapshot.json`).
- Processed: `data/processed/catalog.parquet` with normalized fields and units.
- Indexes: `indexes/lexical/` (SQLite FTS5) and `indexes/semantic/` (FAISS + metadata).

## Minimal Record Schema (conceptual)
- id, sku, url, name, description, short_description
- categories[], tags[], breadcrumbs[]
- price, currency, stock_status (in_stock, oos, legacy, discontinued)
- images[], datasheets[], guides[]
- specs: freeform map of key/value; may include voltage_range, current_max, interface (I2C/SPI/UART), channels, resolution_bits, form_factor, connectors (STEMMA/Qwiic/Feather/QT Py), dimensions
- timestamps: first_seen, last_updated

## Derived/Normalized Fields
- tokens (for BM25/FTS), synonyms, lemmatized terms
- normalized units (V, A/mA, mm), numeric fields for filtering/ranking
- categorical facets (form_factor, interface, connectors)
- embedding vectors for name+description+key specs

## Ingestion Pipeline
- Validate: ensure required fields; drop/flag malformed rows.
- Normalize text: strip HTML, standardize Unicode, sentence segmentation.
- Parse specs: extract units and numbers; map common phrases (e.g., “3V3” → 3.3V; “8‑ch 6‑bit ADC” → channels=8, resolution_bits=6).
- Enrich: infer form factor, connectors, protocols from text and categories.
- Persist processed table and build indexes (lexical + semantic) with doc metadata.

## Freshness Strategy
- Full rebuild: weekly or on catalog JSON updates.
- Stock/price refresh: frequent (e.g., 15–60 min) small snapshot that updates metadata and ranking without re‑embedding.
- Incremental indexing: add/update changed items; remove discontinued when detected.

## OOS & Legacy Handling
- Keep `stock_status` separate from `discontinued/legacy` flags when available.
- Default search excludes OOS; toggle to include OOS with clear labeling.
- Suggest in‑stock substitutes when the top result is OOS or legacy.

## Compliance
- Respect Adafruit’s ToS; prefer official feeds/exports over scraping.
- Attribute links, datasheets, and images back to product pages.

## Open Questions
- Exact catalog JSON schema and field names.
- Availability of an official stock/price feed or API.
- Acceptable refresh cadence and rate limits.
- Whether guides metadata is in scope for enrichment.

## Next Steps
- Obtain a sample of the catalog JSON (10–50 items) to lock schema.
- Implement `scripts/ingest_catalog.py` to produce processed parquet.
- Implement `scripts/build_index.py` for FTS5 + FAISS indexes.
- Implement `scripts/refresh_stock.py` for small, frequent updates.
- Define a synonyms/aliases list for common maker terms.

