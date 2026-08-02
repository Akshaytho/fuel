# Spec 0015 — Fibre, and knowing what we don't know

## Restatement

Fuel tracks energy and three macros. That is the same shape as every calorie
counter, and it is the shape the research says is the least useful part of
the category: Lifesum's Life Score and Cronometer's 92 nutrients both exist
because calories alone don't tell anyone whether they ate well.

Fibre is the cheapest large step from *quantity* to *quality*. It is on
virtually every nutrition label and in the USDA feed we already pull, so
unlike the rest of Cronometer's panel it needs no new data source. It is also
the nutrient the population actually misses: US adults average ~17 g against
an adequate intake of 25–38 g, and roughly 94% fall short.

## The target

**14 g per 1,000 kcal** — the Institute of Medicine Adequate Intake, also
carried by the Academy of Nutrition and Dietetics and the US dietary
guidelines. The commonly quoted 25 g (women) / 38 g (men) figures are that
same rule evaluated at ~1,800 and ~2,700 kcal.

We use the per-energy form deliberately: a clamped 1,200 kcal user should not
be told to eat 25 g, and a 3,500 kcal user should be told more than 38 g.

Source: IOM/NASEM Dietary Reference Intakes, via
https://www.ncbi.nlm.nih.gov/books/NBK559033/

## The honesty problem, and why it is the real feature

Of the 600 foods currently seeded, **513 report fibre and 87 do not.** If a
missing figure is silently read as zero, then a day of exactly those 87 foods
shows "0 g of fibre" — and the app has just told someone they ate badly when
what actually happened is that we don't know.

So fibre is **nullable at every layer**: `foods.fiber_g_per_100g`,
`log_entries.fiber_g`, and the in-memory entry. NULL means *not reported*.
Zero means *genuinely none*. They are different facts and they are displayed
differently.

Alongside the number, Fuel reports **coverage**: the share of today's calories
that came from foods whose fibre we actually know. Below
`FIBER_COVERAGE_MIN` the total is presented as a floor ("at least 12 g") and
the gap is named. This is Cronometer's Data Quality idea, which no other
tracker in the field offers, applied to the one nutrient we have.

## Tone

The clinical literature warns that increasing fibre too quickly causes
bloating, gas and cramping, and advises raising it by 2–3 g every few days.
So fibre is presented as **information, never a daily target to chase**:

- No red state, no "you failed", no streak, no celebration for hitting it.
- The bar fills and stops at 100%; it never turns into a deficit to repay.
- Copy states the number and, when useful, one gentle direction. Never a
  demand, and never a comparison to other days.

## UI mapping

A slim strip under the coach line on Today:

```
Fibre  14 g / 22 g
[▓▓▓▓▓▓▓░░░]  from 85% of today's food
```

When coverage is below the floor, the value reads `at least 14 g` and the
caption names it: `3 items had no fibre figure`.

## Case grid

| Case | Expected |
|---|---|
| all foods report fibre | exact total, coverage 100%, no caveat |
| some foods report none of it | "at least N g" + the count of unknown items |
| NO food reports it | strip shows the unknown state, never "0 g" |
| a food genuinely has 0 g fibre | counts as KNOWN; coverage unaffected |
| nothing logged yet | strip hidden entirely |
| target kcal is 0 or absent | strip hidden; no divide-by-zero |
| over the fibre target | bar full, positive-neutral copy, never a warning |
| legacy entries from before this spec | fibre NULL, coverage reflects it honestly |
| 2 years of entries | summarised in well under the perf budget |

## Out of scope

- Soluble vs insoluble split (Cronometer added it in 2026; needs data we
  don't have).
- Any other micronutrient. The plumbing here is deliberately general, but
  each nutrient is its own data problem.
- A fibre goal the user can edit. The AI is evidence-based and scales with
  their energy target; a user-set fibre goal invites the chasing behaviour
  this spec is trying to avoid.
