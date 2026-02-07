# 2026-02-07 - Semantic Web Worker Debug

## Summary
We added semantic search scaffolding for the web app and then chased a tricky lexical
worker issue that only showed up on full page reloads. The worker would appear offline,
timeouts fired, and progress never appeared. A manual hot-reload from Vite made it work,
which suggested a worker init/handshake problem on cold load.

## What We Built
- Semantic search foundations in the web app:
  - Embeddings JSON parser and storage
  - Semantic index worker with cosine similarity
  - Query embedding via transformers.js
  - Keyword / Hybrid / Semantic toggle
- Embedding generation script:
  - `scripts/generate_embeddings.py` produces `{ model, dimension, items[] }`
  - Defaults to sentence-transformers/all-MiniLM-L6-v2 and maps to Xenova name

## The Problem
Symptoms:
- Index build timed out after reload.
- Worker indicator showed offline.
- Progress bar either stuck at 0 or instantly finished.
- Vite hot-reload made the worker behave.

Likely root cause:
- Large `postMessage` payloads on cold load occasionally fail to reach the worker
  or hit structured clone bottlenecks, which left the UI waiting forever.

## Fixes Applied
- Chunked build protocol for the lexical worker:
  - `build-init`, `build-chunk`, `build-finish`
  - Acknowledgements between chunks
- Worker heartbeat:
  - `ping`/`pong` for online/offline indicator
- Auto-restart:
  - On first ping failure, recreate the worker once and re-run indexing
- Auto-rebuild guard:
  - Only rebuild when status is `idle` or `error` to avoid double-indexing

## Result
On reload, the worker comes online automatically and the index rebuild completes
in ~200-300ms with the correct doc count. Manual restart remains available as a
fallback.

## Follow-ups
- Consider reducing indexed fields for faster builds if payload size grows.
- If we need to support much larger catalogs, move to OPFS-backed on-disk index.
