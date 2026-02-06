# Fruitful Search

Fruitful Search is a local-first assistant that helps makers find the “missing piece” in the Adafruit ecosystem with fast, friendly catalog search.

See `guia.md` for the full product philosophy, capabilities, and design notes.

## Quick start
1. Create config: copy `config/settings.example.yaml` to `config/settings.yaml` and set paths.
2. Get catalog JSON: save it to `data/raw/adafruit_catalog.json`.
3. Create venv: `uv venv && source .venv/bin/activate` (Windows: `Scripts\activate`).
4. Install extras (optional but recommended for full features):
   `uv pip install -e ".[dev,ingest,index,tui]"`
5. Build data/indexes:
   `uv run python scripts/update_catalog_and_indexes.py`
6. Run the TUI:
   `python -m tui`

Console usage:
- One-shot: `uv run fruitful-console "feather i2c" --limit 10`
- JSON: `uv run fruitful-console --json "feather i2c"`
- REPL: `uv run fruitful-console`

## Web MVP
The web MVP is a local-first catalog browser that runs entirely in your browser.
It imports the Adafruit catalog JSON, builds a lightweight lexical index in a Web
Worker, and supports basic search plus in-stock and price filters.

Quickstart:
1. `cd web`
2. `npm install`
3. `npm run dev`
4. Open the Vite URL (usually `http://localhost:5173`).
5. Click `Import catalog` and choose `data/raw/adafruit_catalog.json`.

Notes:
- The catalog JSON should come from the official Adafruit Products API.
- The first import builds the index in the background; status appears in the hero panel.
- Local storage uses OPFS when available and falls back to IndexedDB.
