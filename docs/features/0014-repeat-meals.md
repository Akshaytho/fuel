# Spec 0014 — Meals you repeat

## Restatement

Cordeiro et al. (CHI 2015) measured the thing nobody designs against: users
rate logging fast food and packaged items **6.3–6.5/10** for ease, and
home-cooked meals **4.6/10**. Every tracker's own friction curve nudges people
toward worse food, because a barcode is one scan and a home-cooked plate is
four searches and four portion decisions. They called these "negative nudges",
and it is the most underrated finding in the adherence literature.

Every competitor answers this with saved meals or recipes — a thing you build
by hand, name, and maintain. Yazio's answer is better: **Smart Adding**
notices food combinations you log together and offers to save them for you, so
friction *decreases* the longer you use the app.

Fuel's version keeps the data-in-databases rule intact by storing nothing at
all. A repeated meal is DERIVED from the log history, exactly like go-tos.
Nothing to name, nothing to maintain, nothing to sync, nothing to get stale.

## Behaviour

A **combo** is the set of foods logged to one meal slot on one day, with two
or more items. Two combos are the same when their sets of `foodKey`s match,
regardless of order or portion size.

A combo becomes a **repeat meal** when it appears on `REPEAT_MIN_DAYS = 3`
distinct days inside the `REPEAT_WINDOW_DAYS = 60` window. Repeats are ranked
by how many days they appear on, then by recency, and the top
`REPEAT_LIMIT = 3` are offered for the meal slot the user is logging into.

Tapping one logs every item at the **median grams** across the times they ate
it — not the most recent, because the median is robust to the one morning they
weighed out an unusual portion.

The label is built from the food names, so it needs no naming step and cannot
disagree with what it logs: `Oats + banana + milk`.

## UI mapping

Log sheet, above the go-tos, only when at least one repeat exists for that
meal. One row per repeat: the joined names, then `3 items · 412 kcal · you eat
this most weeks`. One tap logs all of them and closes the sheet, exactly like
Copy Yesterday.

## Case grid

| Case | Expected |
|---|---|
| same 3 foods logged to breakfast on 3 days | offered for breakfast |
| same 3 foods on only 2 days | not offered |
| same foods, different portions each day | offered; logs the median grams |
| same foods logged to different meal slots | slots are counted separately |
| a single food logged 10 days running | NOT a combo — that is a go-to, and duplicating it here would be noise |
| combo logged twice on the same day | counts as one day |
| superset (the usual 3 plus a coffee) | a different combo; both may qualify independently |
| combo last eaten 90 days ago | outside the window, not offered |
| 2 years of logs | ranked in well under the perf budget |
| food logged with no `food_id` (manual entry) | matched by normalised name, same as go-tos |

## Out of scope

- User-named, hand-built recipes with ingredient scaling. That is a bigger
  feature and this one may remove most of the need for it.
- Editing a repeat before logging it. Tap logs it; entries are individually
  removable afterwards, which is the existing, tested path.
