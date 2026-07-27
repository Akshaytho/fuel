# ADR-016: The meal AI parses structure only — the database provides numbers

Status: accepted · 2026-07-27

## Decision
The describe-meal LLM converts free text into structured food items and
quantities (JSON, schema-validated). It NEVER outputs calorie/macro numbers.
Nutrition values are always looked up from our food database keyed to the
parsed items. Parsed results are shown to the user as editable chips before
logging.

## Why
Independent testing (Nutrola vs USDA, 2026): LLM calorie estimates run
±16–22% mean error, only 35–48% within ±10% of truth, and vary ±15–28%
between sessions. Verified databases: ±2–5%. Trust is Fuel's core value;
a silent wrong number is the fastest way to lose it.

## Consequences
- AI cost is bounded (small structured outputs), cacheable by phrasing.
- Accuracy is governed by DB coverage → invest in the food cache + crowd layer.
- An eval suite of known meal descriptions gates every model/prompt change.
