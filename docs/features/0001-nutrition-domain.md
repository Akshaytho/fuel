# Feature 0001 — Nutrition domain engine

Status: APPROVED (session 1) → BUILT → VERIFIED green
Owner: packages/domain · Pure TypeScript, zero dependencies, no IO.

## 1. Restatement

The calculation core every screen depends on: compute a user's daily
calorie/macro targets from their profile and goal (onboarding "Your plan"
payoff screen), convert food-database per-100g values into logged amounts
(portion sheet), and aggregate a day's entries into the Today-screen summary
(consumed, remaining, per-macro progress). No UI, no storage — pure functions
so they are exhaustively testable and reusable by app, widgets, and edge
functions alike.

## 2. UI mapping

- `computeTargets` → "Your plan" screen numbers + Today screen ring targets
- `scalePer100g`, `applyPortion` → Portion sheet live preview
- `summarizeDay` → Today/Summary rings, remaining numbers, weekly report input
- `kcalFromMacros` → honesty check chip ("macros don't match kcal" flag)

## 3. Behavior

- Targets: Mifflin–St Jeor BMR × activity factor → TDEE; goal adjustment
  (lose −20%, maintain 0, gain +10%); protein 1.8 g/kg body weight,
  fat 30% of kcal, carbs = remainder. Calories floor at 1200 kcal/day —
  below that we clamp and flag `clamped: true` (safety: never generate a
  starvation plan).
- Scaling: per-100g × grams/100, half-up rounding to 0.1 g / 1 kcal at the
  domain edge.
- Day summary: sums entries, computes remaining (can be negative = over),
  progress ratio per macro (0..∞, UI clamps display), `isOver` flags.

## 4. Case grid (each case = at least one test)

| Case | Expected |
|------|----------|
| Happy path male/female profiles | Formula-exact values |
| Age/height/weight at plausible extremes | Computed, no NaN/Infinity |
| Zero or negative weight/height/age/grams | throws `InvalidInputError` |
| Non-finite inputs (NaN, Infinity) | throws `InvalidInputError` |
| Aggressive deficit → below 1200 kcal | clamped to 1200, `clamped: true` |
| 0 g portion | zero macros (legal: "logged but none eaten") |
| Empty day | zero consumed, remaining = targets, no division errors |
| Over-target day | negative remaining, `isOver: true`, ratio > 1 |
| Macro/kcal mismatch in DB record | `kcalMismatch` flag ≥ 8% deviation |
| Rounding | 0.1 g / 1 kcal, half-up, stable |

## 5. Out of scope (this feature)

Micronutrients; imperial-unit conversion (UI edge concern); persistence;
per-meal (vs per-day) grouping; exercise adjustment of targets.

## 6. Open questions → resolved

- Q: activity factors? → standard 5-level Mifflin multipliers (1.2–1.9).
- Q: protein by lean mass? → v1 uses body weight (no body-fat input in
  onboarding design); revisit if design adds it.

## Acceptance criteria

AC1 Targets match hand-computed reference for the two reference profiles.
AC2 Every invalid-input row in the case grid throws `InvalidInputError`.
AC3 1200-kcal floor clamps and flags.
AC4 Portion scaling matches hand-computed reference incl. rounding.
AC5 Day summary correct for empty, normal, and over-target days.
AC6 kcal-consistency check flags a mismatched DB record and passes a clean one.
AC7 100% of exported functions covered by at least one test; `pnpm verify` green.
