# Spec 0012 — Partial days must not corrupt the adaptive engine

## Restatement

Fuel's weekly report back-solves energy expenditure from the physics: what you
ate, minus what your weight did. It averages intake across "days that have any
logs". A day where you logged breakfast and then got busy is, to that average,
a 150-calorie day of eating.

Measured (`docs/research/0002`, §6): six days at 1,800 kcal plus one forgotten
day drops measured TDEE from 2,313 to 2,078 and the proposed daily target from
1,850 to 1,662. **One forgotten dinner cuts her recommended intake by 188
kcal.** It compounds: the lower target means she eats less, loses faster than
intended, and the next report cuts again.

This is a correctness bug with a safety dimension. It only ever biases
downward, because forgetting to log always *removes* calories, never adds them.

## Behaviour

Classify each day against the user's calorie target:

| Class | Rule | Counts as a logged day | Feeds the intake average |
|---|---|---|---|
| `none` | 0 kcal | no | no |
| `partial` | 0 < kcal < 50% of target | no | **no** |
| `full` | ≥ 50% of target | yes | yes |
| `confirmed` | `partial`, and the user said it was real | yes | yes |

**Why exclusion is the safe default.** We cannot tell a genuine 900-kcal fast
day from a half-recorded 2,000-kcal one. The two errors are not symmetric:
including a partial day starts a downward spiral in the targets, while
excluding a genuine light day makes the estimate slightly conservative and is
corrected by next week's weight data. So we exclude, and we say so.

**The user gets the final word.** The report names every excluded day and
offers one tap — "that day is right" — which moves it to `confirmed`
permanently and recomputes. Confirmations are stored locally by day string.

## UI mapping

- **Report** — when any day was excluded, a row under the logged-days pills:
  *"Thursday looked half-logged, so we left it out of the maths."* with a
  *"That day is right"* action per day. The pills render an excluded day in a
  third state, distinct from both logged and missed.
- **Today week strip** — a partial day gets its own dot state, so the week
  view never claims a half-logged day was a logged one.

## Case grid

| Case | Expected |
|---|---|
| 7 full days | unchanged from today's behaviour |
| 6 full + 1 partial | partial excluded; TDEE matches the 6-day-only average |
| 6 full + 1 partial, confirmed | partial included; matches the old behaviour exactly |
| 4 full + 3 partial | 4 logged days — passes the `MIN_LOGGED_DAYS` gate |
| 3 full + 4 partial | 3 logged days — report stays locked, honestly |
| 0 full, 7 partial | locked; the report must not invent a TDEE from crumbs |
| 7 plausible-but-light days (65% of target) | reports normally — under-eating that was actually recorded is real data |
| Target is 0 or absent | never classify as partial (degenerate; treat any log as full) |
| A day at exactly 50% of target | `full` — the boundary is inclusive, so a genuine light day is kept |

## The decision we made about a whole week of partials

When *every* logged day looks half-recorded there is a tempting alternative:
trust the pattern, because consistency suggests it is real. We rejected it.
A week of 700-kcal days produces a collapsed measured TDEE, which the ±30%
blend clamp and the sex-specific floor bound at roughly a 1,200 kcal target —
handed to someone whose actual problem is that they stopped logging after
breakfast for a week. Locking and saying so is the safer failure.

The line sits at half the target, so a genuinely light but *recorded* week
(1,000 kcal against a 1,547 target — 65%) still reports normally. Under-eating
that was actually written down is real data and Fuel treats it as such.

## Out of scope

- Asking on the day itself ("did you finish logging?") — a notification
  feature, and Fuel has no notification layer yet.
- Distinguishing a declared fast from a forgotten day at log time. The
  confirm action covers it retroactively; a first-class fasting mode is its
  own spec.

## Open questions

- 50% is a judgement call. MacroFactor does not publish its threshold. 50% of
  target is roughly one substantial meal, which is the shape of "I logged
  breakfast and stopped". Revisit with real user data.
