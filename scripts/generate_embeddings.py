#!/usr/bin/env python3
"""
Generate semantic embeddings JSON for the web app.

Usage:
  python3 scripts/generate_embeddings.py \
    --in data/raw/adafruit_catalog.json \
    --out data/processed/embeddings.json \
    --model sentence-transformers/all-MiniLM-L6-v2

Notes:
- Requires: sentence-transformers (and torch). Install via:
  pip install sentence-transformers torch
- Output format matches web app expectations:
  { "model": "...", "dimension": 384, "items": [{"pid": 123, "embedding":[...]}] }
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable


def load_rows(path: Path) -> list[dict]:
    obj = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    if isinstance(obj, dict) and "products" in obj:
        rows = obj["products"]
    elif isinstance(obj, list):
        rows = obj
    else:
        raise ValueError("Unsupported catalog JSON shape.")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Catalog JSON contains no products.")
    return [r for r in rows if isinstance(r, dict)]


def text_parts(row: dict) -> list[str]:
    parts = []
    for key in (
        "product_name",
        "product_short_description",
        "product_description",
        "product_features",
        "product_specs",
        "product_manufacturer",
        "product_model",
        "product_mpn",
    ):
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    return parts


def build_text(row: dict) -> str:
    parts = text_parts(row)
    return " ".join(parts)


def iter_rows(rows: Iterable[dict]):
    for row in rows:
        pid = row.get("product_id")
        if pid is None:
            continue
        try:
            pid = int(pid)
        except Exception:
            continue
        text = build_text(row)
        if not text:
            continue
        yield pid, text


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", type=Path, required=True)
    ap.add_argument("--out", dest="out_path", type=Path, required=True)
    ap.add_argument(
        "--model",
        dest="model",
        default="sentence-transformers/all-MiniLM-L6-v2",
        help="SentenceTransformers model ID.",
    )
    ap.add_argument("--batch", dest="batch", type=int, default=64)
    ap.add_argument(
        "--model-out",
        dest="model_out",
        default=None,
        help="Optional model name to store in output JSON.",
    )
    args = ap.parse_args(argv)

    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except Exception:
        print(
            "Missing dependency: sentence-transformers. Install with `pip install sentence-transformers torch`.",
            file=sys.stderr,
        )
        return 2

    rows = load_rows(args.in_path)
    pairs = list(iter_rows(rows))
    if not pairs:
        print("No valid rows with product_id + text.", file=sys.stderr)
        return 3

    pids, texts = zip(*pairs)
    model = SentenceTransformer(args.model)
    embeddings = model.encode(
        list(texts),
        batch_size=args.batch,
        show_progress_bar=True,
        normalize_embeddings=True,
    )

    dimension = int(embeddings.shape[1])
    items = []
    for pid, vec in zip(pids, embeddings):
        items.append({"pid": int(pid), "embedding": [float(x) for x in vec]})

    model_out = args.model_out
    if model_out is None:
        if args.model.startswith("sentence-transformers/"):
            model_out = "Xenova/" + args.model.split("/", 1)[1]
        else:
            model_out = args.model

    payload = {
        "model": model_out,
        "dimension": dimension,
        "items": items,
    }

    args.out_path.parent.mkdir(parents=True, exist_ok=True)
    args.out_path.write_text(
        json.dumps(payload, ensure_ascii=True) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(items)} embeddings to {args.out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
