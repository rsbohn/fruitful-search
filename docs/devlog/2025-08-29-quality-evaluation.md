# Quality & Evaluation

Defines how we measure search quality and iterate safely.

## Metrics
- Precision@k (k=3,5,10): proportion of relevant results in top‑k.
- MRR: reciprocal rank of first relevant result.
- Coverage: % of queries that return ≥1 relevant in top‑k.
- Time‑to‑find: turns/time to satisfactory result (from TUI logs).

## Datasets
- Seed query set: 20–50 representative queries with labeled ideal results.
- Gold annotations: YAML/JSON mapping queries → acceptable PIDs (top‑k) and notes.
- Negative cases: ambiguous/underspecified queries to test clarification flow.

## Process
- Offline eval script computes precision@k/MRR on current indexes.
- Track scores across changes; fail CI if regression above threshold.
- Periodically expand the seed set from real usage (opt‑in telemetry).

## Tooling (planned)
- `eval/run_eval.py`: loads `eval/gold.yaml` and prints metrics.
- TUI feedback: optional inline rating (👍/👎) to collect judgments.

## Relevance Guidelines
- Prioritize exact spec fit and in‑stock availability.
- Strong matches include correct interface, form factor, and voltage/current constraints.
- Penalize legacy/discontinued unless explicitly requested.

## External Seed Data (Device Registry)
- You may supply an external device registry to bootstrap synonym/compatibility maps.
- Do NOT commit it. Reference via `config/settings.yaml` → `device_registry_path` (absolute path).
- Scripts should read it if present and derive non‑sensitive artifacts we can commit (e.g., normalized synonym lists).

## Open Questions
- Labeling workflow: who curates gold sets and review cadence?
- Thresholds for CI gating; how to handle expected changes after major index updates.
