# Spec 0016 — Easy Day: one tap logs your usual day

## Restatement

The strongest result in the adherence literature (docs/research/0004, §1):
a randomised pilot found SIMPLIFIED logging — no calorie counting, just
acknowledging what you ate — produced **97% of days tracked versus 49%** for
detailed logging, with **identical weight loss** (−3.3 vs −3.4 kg) and 95% vs
56% satisfaction. Time cost fell from ~34 minutes a day to 2–5.

Nobody in the field ships this as a first-class mode. Every competitor treats
a low-effort day as a failed day. Fuel already refused that framing once
(spec 0012 stopped counting a half-logged day as a light day of eating); this
is the constructive half: give the burned-out, busy, or travelling user a
legitimate one-tap way to keep the record true.

The insight that makes it buildable TODAY: Fuel already knows what "your
usual" is. Repeat meals (spec 0014) knows the combinations you actually eat;
go-tos (spec 0011) knows your staples per meal slot. An Easy Day is those two
engines, composed at day level.

## What one tap means, exactly

"Log my usual day" writes one entry per item of the user's ESTABLISHED usual
for each meal slot that (a) has an established usual and (b) has nothing
logged today. Portions are the median of every time they ate it — the same
robust-portioning rule repeat meals uses.

An "established usual" for a meal slot is, in order:
1. the top repeat combo for that slot (2+ foods on 3+ distinct days in 60), or
2. the top meal-matched go-to for that slot with 3+ occurrences (a person
   whose breakfast is just oatmeal has a usual breakfast of one food).

The affordance exists only when **at least two** meal slots have an
established usual — one habitual breakfast is not a "usual day".

## Honesty (the part that makes this Fuel and not a shortcut to lying)

- Entries carry **source = 'easy'** (migration 0007). The record keeps the
  truth that this was an asserted-typical day, not a weighed one.
- The foods and portions are REAL — drawn from the user's own history, the
  same data a repeat-meal tap writes. The user is asserting "I ate roughly my
  usual", which is information, exactly like ticking a checklist in the trial.
- No streak bonus, no celebration difference, no penalty. An easy-logged day
  is a logged day, full stop — that is the entire point.

## UI mapping

Log sheet, ABOVE "meals you repeat": one row.

  Your usual day                                    ⚡
  Breakfast + Lunch + Dinner · ~1,430 kcal · one tap

When some meals are already logged today, it offers only the remainder and
says so: "Your usual lunch + dinner". Tapping logs everything, closes the
sheet, and confirms with the meal list. Entries appear in TODAY'S MEALS like
any others and are individually removable — the existing, tested path.

Today's surface does NOT change (IA 0001: five blocks, no additions).

## Case grid

| Case | Expected |
|---|---|
| 3 days of the same breakfast combo + dinner combo | offered: "usual day, 2 meals" |
| only breakfast established | NOT offered (one meal is not a day) |
| breakfast combo + dinner is a single repeated go-to | offered — the go-to fallback counts |
| breakfast already logged today | offers "usual lunch + dinner" only |
| every established meal already logged | not offered |
| brand-new user | not offered — no invented "usual" |
| tap → server | one row per item, source='easy', correct meals |
| portions | median across history, macros scaled — identical rule to spec 0014 |
| 2 years of history | computed inside the perf budget |
| an easy day in the weekly report | an ordinary logged day (kcal ≈ typical → 'full') |

## Out of scope

- A per-meal easy log ("usual breakfast" alone) — that is exactly what repeat
  meals already is; this spec is the day-level composition.
- Weighting easy days differently in the adaptive TDEE. The source marker
  preserves the option; the evidence (identical outcomes) does not demand it.
- Any reminder or prompt pushing people into easy mode. It is an offer on the
  logging surface, never a nag.
