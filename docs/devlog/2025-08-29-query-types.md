# Query Types

Defines user intents, patterns, and how we parse natural language into structured constraints for search and UX.

## Core Intents
- Spec search: explicit technical constraints (e.g., “8‑channel 6‑bit ADC i2c 3.3V”).
- Form factor: ecosystem fit (e.g., “Feather with BLE and LiPo”).
- Function/category: task‑oriented (e.g., “USB‑C PD trigger 12V”, “±16g accelerometer”).
- Compatibility: works with X (e.g., “display for QT Py”, “shield for Feather M4”).
- Budget: price‑focused (e.g., “under $10”, “cheapest step‑down regulator 2A”).
- Inspiration: exploratory (e.g., “show me something cool for my next make”).
- Identifier lookup: SKU/part number/slug (e.g., “PID 4510”, “AF‑4510”).

## Patterns & Examples
- Numeric specs: “8‑channel 6‑bit ADC”, “±16g”, “2A 5V buck”, “3.3–5V input”, “240×135 SPI TFT”.
- Interfaces: “I2C/I²C, SPI, UART, USB‑C, CAN”.
- Connectors: “STEMMA QT/Qwiic”, “JST‑PH 2‑pin”, “with headers”, “no soldering”.
- Form factors: “Feather/FeatherWing, QT Py, ItsyBitsy, Trinket, Metro”.
- Price/size: “under $10”, “tiny”, “thin”, “less than 30mm wide”.
- Stock: “in stock only”, “include out of stock”.

## Parsing & Normalization
- Units: normalize V/mV, A/mA, g, mm; handle ranges (e.g., 3–5V), tolerances (“5V tolerant”).
- Operators: ≥, ≤, between, under/over/at least/at most; map to numeric constraints.
- Synonyms: ADC=A/D=analog‑to‑digital; accel=accelerometer; PSU=power supply; PD=Power Delivery; STEMMA QT=Qwiic.
- Misspellings: light fuzzy matching on critical terms; prefer synonyms list to avoid noise.
- Negation: “without headers”, “no soldering” → flags to exclude certain variants.

## Structured Query Shape (internal)
- keywords: remaining free‑text terms after entity/number extraction.
- facets: {form_factor, interface[], connectors[], function, chips[]}
- numerics: {voltage_min/max, current_min, channels, resolution_bits, width_mm/height_mm}
- stock: {include_oos: bool}
- price: {max_cents/min_cents}
- sort: {relevance | price | recency}
- mode: {search | inspire}

## Inspiration Triggering
- If intent resembles “show me something cool/new/popular”, switch to Inspire view (in‑stock by default) with light categories and reasons.

## Compatibility
- Detect host terms: “for Feather/QT Py/Metro/RPi Pico” → prefer matching form factor/accessories.
- Basic rule‑based mapping first; expand with curated compatibility tables later.

## Ambiguity & Clarification
- If multiple interfaces or conflicting ranges are detected, prompt a single, quick disambiguation (non‑blocking) and continue with a reasonable default.

## Error & Fallbacks
- If parsing yields no strong signals, run lexical+semantic on full text and surface top facets as suggestions to refine.

## Configuration Artifacts (planned)
- Synonyms/aliases: `config/synonyms.yaml`
- Units & patterns: `config/units.yaml`
- Compatibility hints: `config/compatibility.yaml`
