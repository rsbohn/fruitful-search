# Pitch: Fruitful-Console “Hands-On Helper”

## Problem
- Gap: Makers bounce between catalog search, stock checks, personal bins, and code examples to validate ideas.
- Friction: When ideal parts are OOS, there’s no guided path to workable substitutes or quick-start scripts.
- Blind spot: Console lacks awareness of local inventory; explainability is limited to names/links.

## Solution
- Augment fruitful-console with stock-aware search, explainable matches, personal-inventory annotation, substitute/workaround suggestions, and one-shot code template emitters for fast prototyping.

## Why Now
- Validated need: Low-precision ADC workflow showed OOS top picks but easy two-board workaround.
- Low lift: Leverages existing FTS5 index and meta.stock; no schema changes or network calls.
- High leverage: Bridges search → selection → wiring/code in one loop.

## User Value
- Faster decisions: See in-stock first, know which items you already own.
- Confidence: “Why it matched” highlights reduce guesswork.
- Momentum: One command emits ready-to-run scripts tailored to the chosen parts and interfaces.
- Resilience: Built-in substitutes keep progress unblocked when the perfect SKU is OOS.

## Key Capabilities
- Stock controls: `--in-stock` filter, `--stock-first` rerank.
- Explainability: `--explain` and `:why <pid>` show matching tokens/snippets.
- Local inventory: `--inventory <csv>` and `:inventory` annotate results with “(owned×N)”.
- Substitutes: `:subs` suggests viable in-stock alternatives (e.g., two 4-ch I2C ADCs or mux+single-ADC).
- Templates: `:script <template> [opts]` emits wiring/reader code (e.g., `pcf8591-dual`, `pcf8591-dual-mcp2221`).

## Proposed UX
- Flags:
  - `--in-stock`: filter to stock > 0.
  - `--stock-first`: rerank to favor in-stock, then BM25.
  - `--explain`: show “why it matched” tokens.
  - `--inventory <csv>`: path to personal stock (defaults via config/settings.yaml).
- REPL commands:
  - `:why <pid>`: highlight matched terms for that item.
  - `:inventory [path]`: load/refresh local inventory CSV.
  - `:own <pid>`: mark as owned (session-local).
  - `:script <template> [opts]`: emit wiring/code templates (e.g., `pcf8591-dual`, `ads1x15`).
  - `:subs`: suggest substitutes/workarounds for last query if top is OOS.

## Technical Approach
- Rerank/filter: Sort by `(stock > 0 desc, bm25 asc)` and drop `stock <= 0` when requested.
- Explain: Token match against `name/model/mpn/manufacturer`; optional FTS5 `highlight()` snippets.
- Inventory: CSV parse (PID, name) → set/count; annotate output lines.
- Substitutes: Rule-based intent from tokens (channels/bits/interface) + in-stock requery and curated fallbacks.
- Templates: Ship minimal Python templates; render to stdout or `./prototype/` with confirmation.

## Dependencies & Risk
- No new core deps: Pure Python, FTS5 already required by index.
- Optional CSV: File-based, path from `--inventory` or `config/settings.yaml`.
- Scope control: Start with ADC flows; generalize later to sensors/displays.

## Success Metrics
- Precision@5 with stock-first: +X% vs. baseline on seed queries.
- Time-to-first-read: < 2 minutes from query to running script in user tests.
- Adoption: ≥50% of console sessions use at least one of `--in-stock`, `:inventory`, or `:script` after rollout.
- Retention: Fewer bounced sessions when top result is OOS.

## Timeline
- Day 1–2: Add flags, explain output; update help.
- Day 3: Inventory CSV annotate; `:inventory`, `:own`.
- Day 4: `:subs` with ADC heuristics; initial fallbacks.
- Day 5: `:script` emitter with two PCF8591 templates; README/examples.

## Future Extensions
- Numeric facets: Parse “8-channel”, “8-bit” into structured filters.
- Broader templates: ADS1x15, MCP3008, mux patterns (CD74HC4051/4067).
- TUI parity: Mirror features in the TUI with result cards and keyboard shortcuts.
- Semantic rerank: Use FAISS vectors when available for better substitute suggestions.

## Ask
- Green-light the console uplift (5 days). Start with stock controls and explainability, then layer inventory, substitutes, and script emitters.

