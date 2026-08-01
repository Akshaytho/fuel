# 0011 — Go-tos & Copy yesterday (log faster from your own history)

## Restatement

"YOUR GO-TOS" has been an empty promise since Phase 1, and "Copy yesterday"
did nothing. Both are the same idea: the fastest way to log what you eat is
to reuse what YOU already logged. Neither invents a list — the ranking is
computed from the user's real entries (data-in-DB rule: the history IS the
data).

## Behavior

- Go-tos rank by: foods logged for THIS meal first (breakfast go-tos at
  breakfast), then frequency, then recency. Foods from other meals fill the
  remaining slots so a user with history is never shown an empty row at an
  unusual hour. Window 60 days, 4 slots.
- The row shows the user's MOST RECENT logging of that food (grams + macros),
  so one tap reproduces exactly what they ate last time — offline, no
  re-fetch, no re-derivation of per-100g values.
- "you log this often" appears at count ≥ 3 — earned, not decorative.
- Copy yesterday shows a count ("Copy yesterday · 2") and is HIDDEN entirely
  when yesterday is empty (no dead affordance, per the no-dead-controls rule).
  It copies exactly yesterday's items, each into its original meal.
- Zero history → an honest empty line explaining when the row fills, never a
  fabricated suggestion.

## Out of scope

Saved/favourite foods the user curates by hand (separate feature, the
"Saved" tile stays honest-soon); portion editing during quick-add (tap the
food name to open the portion sheet — already exists via search).

## AC

AC1 domain tests for ranking, meal preference, recency tie-break, window,
limit, most-recent-values, and yesterday selection incl. month boundary.
AC2 fresh-user journey: go-tos row states it's empty; copy-yesterday absent.
AC3 journey: after logging, the food IS a go-to and ONE TAP re-logs it —
entry count 2, calories 1,553−89−89 = 1,375, both synced.
AC4 rich check: seeded history produces ranked go-tos; Copy yesterday · 2
creates exactly 2 rows today in Postgres, named as yesterday's items.
