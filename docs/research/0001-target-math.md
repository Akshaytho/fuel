# Research 0001 — Is Fuel's target math right?

Date: 2026-07-28 · Trigger: Harish — "I don't think you are calculating
correctly based on user data… you may need some deep research."
This doc records what the evidence says, what we had, and what changed.
Every constant in `packages/domain/src/targets.ts` now traces to a line here.

## 1. BMR equation — Mifflin–St Jeor ✅ KEEP

- Men: 10W + 6.25H − 5A + 5 · Women: 10W + 6.25H − 5A − 161 (W kg, H cm, A yr)
- A 2005 systematic review (Frankenfield et al., J Am Diet Assoc) found it
  predicts measured RMR within 10% for more people — both non-obese AND
  obese — than Harris-Benedict and the WHO equation, with a narrower error
  range. On that basis the Academy of Nutrition and Dietetics (then ADA)
  recommends it for routine use.
- Our implementation matches the published formula exactly. **No change.**

## 2. Activity multipliers (1.2 / 1.375 / 1.55 / 1.725 / 1.9) ✅ KEEP, ⚠ UI copy

- These are the standard PAL multipliers used with Mifflin–St Jeor.
- Known failure mode in every tracker: users OVERSTATE their level (desk
  worker + 2 gym visits picks "moderate" and gets ~300 kcal too many).
- Fix belongs in UI copy, not math: anchor each level to concrete
  steps/sessions ("Sedentary — desk job, <5k steps") and bias the default
  selection LOW. Logged as UI task; multipliers themselves stay standard.

## 3. Goal adjustment ⚠ CHANGED

- Had: lose = −20% TDEE (uncapped), gain = +10% TDEE (uncapped).
- Evidence (MacroFactor Fat Loss Handbook, standard sports-nutrition
  guidance): target 0.25–1% body weight/week; ~1 kg (2 lb)/week is the
  sensible upper limit, and percentage deficits must NOT scale infinitely —
  a 3,800-kcal-TDEE user at −20% is already −760/day; heavier users would
  blow past safe rates.
- Now: **lose = min(20% of TDEE, 1000 kcal/day)** (≈1 kg/week cap);
  **gain = min(10% of TDEE, 500 kcal/day)** (lean-gain surplus guidance is
  ~250–500 kcal; more is fat, not muscle).

## 4. Calorie floor ⚠ CHANGED

- Had: 1200 kcal for everyone.
- Widely used medical guidance (WebMD/Medical News Today, dietetic
  practice): below **1200 (women) / 1500 (men)** is very-low-calorie-diet
  territory requiring medical supervision; men's floor at 1200 was wrong.
- Now: **sex-specific floor 1200 F / 1500 M**, still flagged via `clamped`.

## 5. Protein ⚠ CHANGED (the biggest correction)

- Had: 1.8 g/kg × TOTAL body weight, all goals.
- Evidence: in a deficit, 1.6–2.2 g/kg preserves lean mass (Longland et
  al. AJCN 2016 RCT; Clinical Nutrition ESPEN 2024 meta-analysis); higher
  end matters most while dieting. At maintenance/surplus 1.6–1.8 suffices.
- Total-body-weight basis breaks for high body weight: protein turnover
  happens in fat-free mass, so heavy users get absurd targets (150 kg →
  270 g = 1,080 kcal of protein) that crowd out every other macro — the
  exact failure MacroFactor and Dickerson (Nutr Clin Pract 2017) warn
  about. We don't collect body-fat %, so we use the standard clinical
  proxy: **adjusted reference weight** — if BMI > 25, reference = weight
  at BMI 25 + 0.25 × (actual − weight at BMI 25); else actual weight.
- Now: **g/kg of REFERENCE weight, by goal: lose 2.0 / maintain 1.6 /
  gain 1.8**, and protein is additionally capped at **35% of target kcal**
  (AMDR upper bound) so the macro budget can never go negative.

## 6. Fat — 30% of calories ✅ KEEP

- AMDR is 20–35% of calories; 30% is mid-range and supports hormone
  health. With protein ≤ 35% and fat = 30%, carbs ≥ 35% of calories by
  construction — the macros now always sum to the calorie target.

## 7. Water — 35 ml/kg ⚠ CLAMPED

- 35 ml/kg is a common clinical heuristic and lands near EFSA adequate
  intakes (2.0 L F / 2.5 L M from beverages) for typical weights.
- Unclamped it explodes with weight (200 kg → 7 L — dangerous advice).
- Now: **35 ml/kg clamped to [1.5 L, 4.0 L]**, still rounded to 0.25 L.

## Invariants the engine now guarantees (unit-tested)

1. protein_kcal + fat_kcal + carbs_kcal ≈ kcal target (±1 kcal rounding).
2. kcal ≥ sex floor; deficit ≤ 1000; surplus ≤ 500.
3. carbs_g ≥ 0 always (35% protein cap makes remainder ≥ 35% of kcal).
4. Water ∈ [1.5, 4.0] L.
5. Same inputs → same outputs on device, harness, and server export.

## Sources

- Frankenfield et al. 2005 systematic review (basis of AND recommendation):
  https://www.jandonline.org/article/S0002-8223(05)00149-5/abstract
- RMR equation bias/accuracy in non-obese & obese adults:
  https://pubmed.ncbi.nlm.nih.gov/23631843/
- Mifflin–St Jeor explainer w/ ADA position: https://mifflinstjeor.com/mifflin-st-jeor-equation/
- Longland et al., higher protein in deficit → more lean mass, less fat:
  https://ajcn.nutrition.org/article/S0002-9165(22)06559-5/fulltext
- Protein & muscle retention meta-analysis (overweight/obese):
  https://www.clinicalnutritionespen.com/article/S2405-4577(24)00176-1/abstract
- Protein needs in obesity (adjusted-weight rationale), Dickerson NCP 2017:
  https://aspenjournals.onlinelibrary.wiley.com/doi/10.1177/0884533617691745
- Practical protein guide (fat-free-mass basis), Examine: https://examine.com/guides/protein-intake/
- MacroFactor Fat Loss Handbook (0.25–1% BW/week, ~1 kg/wk cap, 1.6–2.2 g/kg):
  https://macrofactor.com/wp-content/uploads/2025/11/MacroFactor-Fat-Loss-Handbook.pdf
- Minimum-calorie guidance 1200 F / 1500 M: https://www.medicalnewstoday.com/articles/326343
  and https://www.webmd.com/diet/what-is-1200-calories-diet
