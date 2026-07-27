# Vision notes from Harish — 27 July 2026 ("Future upgrades")

Captured verbatim-in-spirit from Harish's note; this is the product's
north star beyond v1 nutrition tracking.

## The note (paraphrased faithfully)

First we need to design the food/diet side very strong. The goal is personal:
never give up on anything; everything done with 100% effort, every day;
stay productive, rest when needed; the app should drive more and more.
Mind needs to be strong with body. For physical development (inspired by the
solo-leveling anime character): diet is most important, strength via
hypertrophy training, mobility and joint health via their respective
exercises, and rest/recovery. There may be more pillars — think of them.
A "solo leveling" app doesn't mean one thing; it needs all of these.

## What this means for the roadmap (recorded, NOT v1 scope)

Fuel v1 stays exactly as scoped: world-class nutrition tracking (the design
doc). That is the "diet side very strong" and it ships first.

The note defines **v2+ modules** around the same person-level goal system:

1. **Training (hypertrophy)** — program + set/rep logging, progression.
2. **Mobility & joints** — routine library, adherence tracking.
3. **Rest & recovery** — sleep/rest-day tracking, deload awareness.
4. **Leveling layer** — the "solo leveling" identity: goals, streaks,
   levels/ranks earned across ALL pillars (diet, training, mobility, rest).
   v1's celebration moment + weekly report are the seed of this layer.

## Architecture implications (why nothing needs to change now)

- The schema already centers on `profiles` + per-day facts; new pillars are
  new fact tables (workouts, mobility_sessions, rest_days) beside
  `log_entries` — no rewrite.
- The leveling layer is computed from per-day facts (like trends), so
  building v1's aggregation cleanly IS building v2's foundation.
- Design system + tokens carry over unchanged.

Backlog items: B-04 (v2 pillar modules), B-05 (leveling/gamification design).
