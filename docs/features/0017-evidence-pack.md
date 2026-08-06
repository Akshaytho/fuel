# Spec 0017 — Three retention mechanics from the evidence (E-04/05/06)

All three come straight from docs/research/0004. Each is small alone; together
they cover the three moments the literature says decide whether a person is
still here next year: the hour they log, the week they judge themselves by,
and the day they come back.

## E-06 · Hourly go-tos (the hour they log)

MacroFactor's best mechanic: "learn to recommend your go-to foods at the times
you tend to eat them." Fuel's go-tos already rank by meal slot; this adds the
hour. Within a meal slot, foods whose TYPICAL logging hour is close to right
now rank first — the 7 am eggs person and the 10 am oats person see different
lists at 7 and at 10, even though both are "breakfast".

Mechanics: each food's typical hour is the MEDIAN UTC hour of its meal-matched
logs (median, so one odd 3 pm breakfast doesn't move it). Distance is circular
(23:00 vs 00:00 = 1 h). Proximity is BANDED — within 1 h, within 3 h, farther —
so a staple logged 20 times an hour off still beats a one-off logged exactly
now. Both sides use UTC so the timezone offset cancels; a DST shift costs at
most an hour, inside the first band. Ranking: meal match, then band, then
count, then recency. Portions stay the remembered most-recent, as today.

## E-05 · The weekly floor (the week they judge themselves by)

*Obesity* 2024: self-monitoring ≥3 days/week supported long-term maintenance.
Every app implicitly demands 7/7 via streaks; 3+ is a REAL success state, and
celebrating it creates a population of successful users competitors define as
failures. It is also structurally un-shameable: the line APPEARS at 3+ and is
simply absent below — never "only 2 of 3", never a countdown, per the harm
rules.

Progress → Week, under the strip: "3+ days a week is the level research links
to lasting results — you're there." Domain: `weeklyFloorHit` on WeekGlance
(logged days ≥ 3, rest days not counted — they are covered days, not logged
ones).

## E-04 · Quiet re-entry (the day they come back)

The strongest measured predictor of logging decline is INFORMATION AVOIDANCE
(P<.001): people stop because they don't want to see the number. The
month-7 lapser who reopens the app must not be met with a verdict, an amount
of time, or an old streak brag.

So the comeback card forks at `COMEBACK_QUIET_GAP_DAYS = 30`:
- Short gap (2–29 days): today's behaviour — "Welcome back — 3 days off. Your
  best run is 12 days." The gap is recent, the run is warm, naming both helps.
- Long gap (30+): "Good to see you. Start with whatever's in front of you —
  nothing to make up for, nothing to backfill." NO day count, NO best-run
  (a two-year-old streak brag is a museum piece), no numbers at all.

The rest of the app already cooperates: the empty Today shows a target, not a
verdict; the report shows "almost ready", not a judgment; nothing anywhere
asks them to backfill.

## Case grid

| Case | Expected |
|---|---|
| eggs@7:00 ×3, oats@10:30 ×3, both breakfast | at 7: eggs first; at 10:30: oats first |
| staple ×20 one hour off vs one-off exactly now | staple first (banding) |
| 23:30 habit queried at 00:15 | close (circular distance) |
| no hour passed | ranking identical to today (param optional) |
| 3 full days logged this week | floor line present on Week |
| 2 days logged | NO line, no countdown, nothing |
| rest day covering a 3rd day | not counted — line absent at 2 logged |
| away 3 days | old comeback: gap named, best run named |
| away 45 days | quiet: no digits anywhere in the card, no best run |
| away 2 years | same quiet card |
| brand-new user | no card at all, as today |
