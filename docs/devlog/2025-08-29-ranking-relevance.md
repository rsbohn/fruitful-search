# Ranking & Relevance

Defines how results are scored, ordered, and explained.

## Objectives
- Put truly relevant, in‑stock items first.
- Favor precise spec fit (e.g., channels/bits/voltage) over fuzzy description matches.
- Be transparent: show why a result matched, and how close the fit is.

## Hybrid Retrieval
- Candidates: top‑N from SQLite FTS5 (BM25) over name/short_desc/desc/tags + top‑M from FAISS (cosine) on embeddings of name + condensed specs.
- Merge: union by product id; keep both lexical and semantic scores for reranking features.

## Rerank Signals (features)
- Lexical: normalized BM25 (0..1).
- Semantic: normalized cosine similarity (0..1).
- Spec fit: 0..1 based on constraint proximity (e.g., target channels=8 → exact=1.0, near=0.8, far=0.2); combine across extracted attributes (channels, resolution_bits, voltage range, interface, form factor, connectors).
- Stock: in_stock boost; OOS neutral; legacy/discontinued penalize unless explicitly included.
- Recency: mild boost for newer `date_added` (log‑scaled).
- Popularity (optional): click‑through/add‑to‑cart rates when available.
- Price preference (optional): if user selects $/$$/$$$ band.

## Scoring (MVP)
- score = 0.35*lexical + 0.25*semantic + 0.25*spec_fit + 0.10*stock + 0.03*recency + 0.02*popularity
- Stock mapping: in_stock=1.0, oos=0.0, legacy=‑0.5, discontinued=‑0.8 (clipped 0..1 after weighting).
- Exact‑spec tie‑breakers: prefer lower price, then recency.

## Explainability
- Show highlighted matched terms in name/description.
- Display a compact “why” line: e.g., “Matched: 8‑ch ADC, 6‑bit, I2C, STEMMA QT; in stock”.
- Include a spec distance badge when slightly off (e.g., “closest: 10‑ch @ 10‑bit”).

## Diversity & De‑duplication
- Group variants (e.g., packs, with/without headers) and show one representative at a time; expand on demand.
- Avoid showing near‑duplicates from the same family in the top 3; apply a small diversity penalty within the first page.

## OOS & Substitutes
- Default exclude OOS; when user includes OOS, still boost in‑stock.
- If the best semantic/lexical match is OOS/legacy, surface a “close in‑stock alternative” card immediately after it.

## Query Handling
- Numeric/spec parsing: extract channels, bits, voltage/current, interfaces, form factor keywords.
- Multi‑intent: if query mixes disjoint intents, ask a quick clarifying question; otherwise treat as OR with lower weight per intent.
- Misspellings/synonyms: expand query with synonyms/aliases list; keep originals weighted higher.

## Evaluation & Tuning
- Create a seed set of 20–50 labeled queries with ideal top‑3 results.
- Track precision@k and MRR; adjust weights; consider learning‑to‑rank once data is available.

## Performance Notes
- Cache per‑query retrieval for brief windows; precompute doc norms.
- Keep rerank math simple (vectorized) to maintain <50ms scoring for typical candidate sets.

