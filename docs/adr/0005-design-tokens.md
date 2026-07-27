# ADR-005: Design tokens are the only styling source

Status: accepted · 2026-07-27

## Decision
Every color, spacing, radius, type size and shadow is a named token in
packages/tokens. Components consume tokens; raw values are lint-forbidden.
Themes (light/dark/directions) are value maps over the same token names.

## Why
The design doc explored 8 visual directions over identical screens — the
visual language is themeable by intent. Retrofitting tokens later = full UI
rewrite (highest-regret reversal). Dark mode becomes data, not a feature.

## Consequences
Token changes are design decisions reviewed in one file; screens cannot
drift; the "Native" palette extracted from the design doc is the v1 theme.
