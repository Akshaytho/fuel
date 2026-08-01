# 0010 — Weekly Report (design 4e, production Native direction)

## Restatement

The Report tab stops being a stub. Every completed ISO week (Mon–Sun) gets
an honest check-in: what your weight actually did, how consistently you
logged, and — when the data has earned it — your burn (TDEE) recalibrated
from energy balance, with proposed next-week targets the user must
explicitly ACCEPT (or adjust manually). No data fabricated; a week without
enough data says exactly what to log to unlock the report.

## The math (energy balance — the physics, not the formula)

measuredTDEE = avgDailyIntake − (Δtrend_kg × 7700 kcal/kg ÷ windowDays)
(losing 0.5 kg over 7 days while eating 1,800/day ⇒ burn ≈ 1,800 + 550 = 2,350)

Data sufficiency gates (all required, else honest locked state):
- ≥ 4 logged days in the report week (intake average is meaningless below)
- weigh-ins spanning ≥ 5 days across the window (trend delta needs anchors)
- window = report week ±3 days of weigh-ins for the smoothed trend endpoints

Blend: proposedTDEE = clamp(measured, formulaTDEE × 0.7 … × 1.3) — a single
crazy week (illness, travel) cannot move targets more than ±30% from the
physiology-backed baseline. Then next-week kcal = proposedTDEE + the same
capped goal deltas and sex floors as research 0001; macros re-split with the
same protein/fat/carb rules (shared code, not duplicated).

## Verdict bands (vs goal)

lose: on pace −0.2…−0.8 kg/wk · maintain: |Δ| ≤ 0.25 · gain: +0.1…+0.5.
Above/below band → "Faster than planned." / "Slower than planned." — factual
words, zero shame. Copy never says "bad week".

## UI mapping (side-by-side vs out/design-report.png)

- "WEEK N · <range>" caps header (N = weeks since createdAt), verdict
  headline, one narrative sentence with the real Δ.
- Weight trend card: mini TrendLineChart, slope badge (goal-aware color).
- "Your burn, recalibrated" card: old → new, sub "From your logs + weigh-ins".
- Days logged: 7 pills, missed days hollow. 6/7 style count.
- NEXT WEEK'S TARGETS: kcal/day, protein g, weekly goal kg.
- CTA "Accept new targets" (persists plan + syncs, same dirty-flag path) ·
  "Adjust manually" → prefilled change-goal flow.
- Locked state: which gate failed, in plain words, with the count needed.

## Out of scope

Push notification on week completion (Phase 3); historical report browsing
(v1 shows the most recent complete week only); "Adjust manually" fine-tuning
sheet beyond the existing goal flow.

## AC

AC1 unit tests: energy-balance math incl. hand-computed cases, gates,
blend clamps, verdict bands, week numbering across year rollover.
AC2 fresh-user journey: Report tab opens (tab live, not dimmed) and shows
the locked state naming the missing data. AC3 rich-state proof: a server-
seeded 3-week account signed in via taps shows verdict + recalibrated burn +
accepting targets updates plan on screen AND profiles row in Postgres.
AC4 verify + both harnesses green.
