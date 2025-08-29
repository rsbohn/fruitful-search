# Backgrounder: Purpose & Users

This document captures intent and context for the assistant so implementation and UX decisions remain aligned with maker needs.

## Audience
- Makers, hobbyists, and prototypers who have an idea and need the “missing piece.”
- Not just shoppers; users often know constraints (voltage/current/protocol/form factor) but not exact part names.

## Primary Jobs-To-Be-Done
- Specific part hunt: e.g., “eight channel six bit A/D,” “Feather with BLE and LiPo,” “±16g I2C accelerometer.”
- Inspiration/exploration: e.g., “show me a cool product I can include in my next make.”

## Assistant Behavior
- Friendly and exploratory; asks clarifying questions when specs are ambiguous or conflicting.
- Explains why results match (key specs, protocols, form factor) to build trust and accelerate iteration.
- Supports both one-shot queries and lightweight back-and-forth refinement.

## Stock & Catalog Realities
- Default focus is in‑stock items to reduce friction and increase build velocity.
- Allow users to include out‑of‑stock (OOS) items on request.
- Annotate OOS items with subscription prompts; Adafruit may spin new runs when interest is high.
- Many older items are unlikely to be reissued; clearly signal “legacy/low‑probability restock.”
- Ranking should favor in‑stock, then high‑relevance OOS; surface close alternatives that are in stock.

## UX Implications
- Prominent in‑stock filter (default ON) with a simple toggle to include OOS.
- Result cards show: stock state, key specs, form factor, connectors, price, and link.
- For OOS: show subscribe CTA and, when possible, in‑stock substitutes.
- For inspiration: a curated/randomized “cool product” surfacing recent/popular/novel items that are in stock.

## Success Signals
- Users find a compatible part quickly (few refinement turns).
- Reduced time from idea → part → cart.
- Healthy usage of inspiration mode without overwhelming users with irrelevant items.

## Representative Queries
- “eight channel six bit A/D”
- “feather with BLE and LiPo”
- “USB‑C PD trigger 12V”
- “show me something cool for my next make”

