# Filters & Constraints

Defines the facets, numeric ranges, defaults, and behaviors used to narrow results and guide users toward compatible parts.

## Core Facets
- Stock: in-stock (default ON), include OOS toggle; optional legacy/discontinued visibility.
- Price: min/max in currency; support simple presets ($, $$, $$$).
- Form factor: Feather, FeatherWing, QT Py, ItsyBitsy, Trinket, Breakout, Metro, etc.
- Interfaces: I2C, SPI, UART/Serial, USB, CAN, GPIO, PWM, ADC, DAC.
- Connectors: STEMMA QT/Qwiic, STEMMA, JST-PH/JST-SH, headers, terminal blocks, USB-C/Micro-B.
- Function/category: sensor, display, power, MCU/SoC, RF/Radio, motor/driver, LEDs/lighting, audio.
- Chips/families (optional): ATSAMD, ESP32, nRF52, RP2040, APDS9960, LIS3DH, etc.

## Numeric Ranges (unit-normalized)
- Voltage input range (V): e.g., 3.0–5.5V; derive min/max and 3.3V/5V tolerant flags when possible.
- Current capability (A or mA): supply/output current for regulators/drivers.
- Channels: e.g., ADC channels, GPIO count.
- Resolution (bits): ADC/DAC/display depth when applicable.
- Power draw (mA/W): idle/active if available.
- Dimensions (mm): width/height/depth; optional area/volume for compactness.

## Behavior
- Defaults: in-stock ON; other facets unset; sort by relevance (stock-aware).
- Hard vs soft filters: numeric ranges apply as hard constraints; when zero results, suggest relaxing bounds.
- Tolerance: allow fuzzy match window (e.g., ±10%) as a soft expansion when few results; clearly labeled.
- Facet counts: show counts next to major facets (computed from current result set).
- No-results UX: show which filters likely excluded results and offer quick clear/relax actions.
- Persistence: remember last-used filters per session; easy reset to defaults.

## Parsing & Units
- Normalize common notations: 3V3 → 3.3V; 5V tolerant → voltage_tolerance=5V.
- Extract numerics from text/specs and store normalized numeric fields for filtering and ranking.

## Stock & Legacy
- Stock states: in_stock, out_of_stock, backorder, legacy, discontinued (map to available source flags).
- Ranking: favor in-stock; when OOS is included, still prefer in-stock unless user sorts by price or recency.
- Substitutes: when the top match is OOS/legacy, surface in-stock alternatives with closest spec fit.

## Future/Optional
- Temperature range, environmental ratings.
- Certifications (CE/FCC/RoHS), if exposed.
- Geographic constraints (ship-from), if relevant.

## Implementation Notes
- Store facets and numeric fields in the metadata store alongside FTS5/FAISS docids.
- Precompute sortable keys (e.g., price_cents, size_mm2) to keep queries fast.
- Provide a compact representation of active filters for the TUI status bar.
