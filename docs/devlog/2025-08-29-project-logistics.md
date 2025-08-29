# Project Logistics

Defines runtime targets, packaging, dependencies, tooling, and repo layout to keep the project maintainable and easy to contribute to.

## Runtime
- Python: 3.11+ (tested on 3.11/3.12).
- Platforms: Linux and macOS first; Windows supported for TUI.

## Packaging & Dependencies
- Packaging: PEP 621 `pyproject.toml`.
- Dependency manager: `uv` (chosen). Plain `pip` + `venv` also fine if preferred locally.
- Extras:
  - `tui`: `textual`, `rich`.
  - `index`: `faiss-cpu` (or alternative: `annoy`), `numpy`.
  - `ingest`: `pandas` or `polars`, `pyarrow`.
  - `dev`: `ruff`, `black`, `mypy`, `pytest`.
- Notes:
  - Start with lexical search (SQLite FTS5) which has no third‑party dependency.
  - Add FAISS only when semantic rerank is enabled (optional extra).

## Repo Layout (planned)
- `core/`: search engine, query parsing, ranking, explain.
- `tui/`: Textual app (views, widgets, theme).
- `scripts/`: `ingest_catalog.py`, `build_index.py`, `refresh_stock.py`.
- `config/`: `settings.yaml`, `synonyms.yaml`, `units.yaml`, `compatibility.yaml`.
- `data/`: `raw/`, `processed/`, `tmp/`, `cache/` (git‑ignored).
- `indexes/`: lexical (SQLite) and semantic (FAISS) (git‑ignored).
- `assets/cache/`: local image cache (git‑ignored).
- `docs/devlog/`: design notes and decisions.

## Tooling
- Lint: `ruff` (quick checks).
- Format: `black` (88 cols default).
- Types: `mypy` (incremental, `strict_optional=True`).
- Tests: `pytest` with a small seed corpus for functional tests.
- Precommit (optional): run ruff/black/mypy on changed files.

## Scripts & Tasks (examples)
- `python scripts/ingest_catalog.py` — produce `data/processed/catalog.parquet`.
- `python scripts/build_index.py` — build FTS5 + FAISS indexes into `indexes/`.
- `python scripts/refresh_stock.py` — update stock/price metadata.
- `python -m tui` — launch the TUI app.

## uv Usage
- Create venv: `uv venv` (then activate `.venv`).
- Install dev + extras: `uv pip install -e ".[dev,ingest,index,tui]"`.
- Run scripts with uv: `uv run python scripts/ingest_catalog.py`.

## Configuration
- `config/settings.yaml` keys (proposed):
  - `data_paths`: raw/processed/indexes/assets.
  - `search`: candidate sizes, weights, defaults (in‑stock).
  - `refresh`: cadence for full/stock updates; API base URL.
  - `compliance`: `rate_limit_per_min: 5`, `image_cache: assets/cache/`, `no_hotlinking: true`.

## CI (optional)
- GitHub Actions: matrix on 3.11/3.12, run ruff/black --check/mypy/pytest.

## Versioning & Releases
- SemVer once public; changelog per release; keep indexes/data out of source control.

## Open Questions
- Poetry vs `uv` preference.
- Pandas vs Polars for ingestion.
- FAISS vs Annoy for semantic index (and whether to include by default).
