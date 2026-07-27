# Feature 0005 — Log flow: Log sheet, Search, Portion sheet (P1-04)

Status: SPEC → BUILD → VERIFY (tests + live-DB search check + side-by-side screenshots)
Design refs: turn-4/5 "Log sheet", "Search food", "Portion sheet" (extracted → out/design-log-flow.png)

## 1. Restatement

The three surfaces of logging. LOG SHEET (bottom sheet over dimmed Summary):
search field, four action tiles (Scan/Describe/Label/Saved), "YOUR GO-TOS ·
<MEAL>" frequent-foods list with one-tap + logging, "Copy yesterday" link,
footer hint. SEARCH (full screen): live query against OUR foods DB (600+
seeded), match-highlighted results with per-serving info and one-tap +,
"Can't find it? Describe it instead" row. PORTION SHEET: food title +
"Edit food", usual-portion subtitle, portion chips (fractions + grams mode),
LIVE macro preview computed by domain scalePer100g, meal chips, CTA
"Log to <Meal> · <kcal> kcal".

## 2. Working functionality in scope (not just pixels)

- Search queries the real Supabase foods table (PostgREST, anon read policy
  — migration 0003; revisit at launch, backlog B-08). Debounce is P1-05's
  store concern; here repo call per keystroke ≥2 chars.
- Portion math live: chips ×0.5/1/1.5/2 of serving (or grams entry) →
  domain scalePer100g → preview tiles + CTA kcal update.
- Every control wired or explicitly stubbed with TODO(task-id):
  Scan→P2, Describe→P2, Label→P2, Saved→backlog, Copy yesterday→P1-05,
  Edit food→backlog.

## 3. Token correction (design authority)

Production macro colors: protein=ORANGE, carbs=PURPLE, fat=BLUE.
Theme semantic tokens updated to match; all consumers updated.

## 4. Case grid

| Case | Expected |
|------|----------|
| Search <2 chars | go-tos/hint state, no query fired |
| Search hit | highlighted prefix, results with real DB values |
| Search zero results | "Describe it instead" row remains as escape hatch |
| Repo/network error | inline "couldn't search" note + describe row (never dead-end) |
| Portion chip change | all 4 tiles + CTA kcal recompute (domain math) |
| Grams mode | numeric grams drive scalePer100g directly |
| Meal chip | CTA text follows selected meal |
| Dark mode | all three surfaces, tokens only |

## 5. Acceptance

AC1 scripts/check-search.mjs proves live search against Supabase (machine).
AC2 Portion math covered by existing domain tests (scalePer100g) + chip
    multiplier unit test.
AC3 Side-by-side screenshots vs design-log-flow.png, light+dark, reviewed.
AC4 pnpm verify green; expo export clean; zero raw values; strings central.
