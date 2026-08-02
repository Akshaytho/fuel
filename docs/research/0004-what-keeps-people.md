# Research 0004 — What actually keeps people using a tracker

Commissioned after Harish asked for research into "what features most people
need and want, to use our app more and more". The answer is not the feature
list I expected, so this document leads with the finding that should change
the roadmap.

## The single strongest result in the literature

Randomised pilot, 38 adults, 3 months. Detailed logging (full calorie counting)
vs **simplified** logging (tick off "red zone" foods on a checklist, no calorie
counting at all):

| | Detailed | Simplified |
|---|---|---|
| Median % of days tracked | 49% | **97%** |
| Satisfied with the method | 56% | **95%** |
| Time cost per day | ~34 min | 2–5 min |
| Weight loss at 3 months | −3.4 kg | −3.3 kg |

**Identical outcome. Double the adherence.**
(JMIR Formative 2022 — https://formative.jmir.org/2022/12/e42191)

Nobody in the field ships this as a first-class mode. Every app treats partial
or low-effort logging as failure — which is the same instinct Fuel already
corrected once, in spec 0012, when it stopped counting a half-logged day as a
light day of eating.

## Four more findings that contradict common sense

**1. The cliff is month 7–8, not month 3.** In a maintenance cohort (n=72),
diet logging broke first and hardest: only 21% sustained ≥50% adherence, mean
month of decline 7.58, versus 40% for weight and 61% for exercise. Once
someone lapses, only **33–46% ever re-engage**.
(https://mhealth.jmir.org/2023/1/e45057)

**2. The strongest predictor of dropout is information avoidance** (P<.001) —
people stop logging because they don't want to see the number. An app that
demands a verdict on every open is selecting for its own abandonment.

**3. Three days a week is a real success state.** 75 adults: ≥3 days/week
supported long-term maintenance; 5–6 supported continued loss.
(*Obesity* 2024 — https://onlinelibrary.wiley.com/doi/10.1002/oby.23994)
Every app on the market implicitly demands 7/7 through streaks. Defining and
celebrating "3+ days this week" creates a large population of successful users
that competitors define as failures — and it is structurally un-shameable.

**4. Notifications move today, not month three.** A micro-randomised trial
(n=598) found a **3.5× lift in app opens within an hour** of a notification —
and **no difference at all in time to disengagement** (median 11 days with
notifications, 11 with a smarter policy, 7 with none).
(https://mhealth.jmir.org/2023/1/e38342) Reminders are a tactical tool. They
are not a retention strategy, and budgeting them as one is a mistake.

## What long-term users actually name

Across multi-year App Store reviews, four themes recur — and only one is a
feature:

1. **Accumulated history as a switching cost.** When MyFitnessPal forced its
   new Today tab, users who wanted to leave said the thing holding them was
   their multi-year streaks and saved recipes.
2. **Trust in the numbers** — curated data, exact-gram entry.
3. **A successful transition to maintenance.** The multi-year reviews are
   maintenance stories, not weight-loss stories.
4. **Community.**

What multi-year users never name: AI photo logging, meal plans, coaching
content, gamification. Those appear in first-week reviews. That asymmetry is
itself the finding.

## Most-requested features, and where Fuel stands

Ranked from ~180 threads on Cronometer's public feature-request forum (with
view/comment counts) and MyFitnessPal's community suggestions.

| # | Request | Fuel today |
|---|---|---|
| 1 | Device integrations (Garmin, Whoop, CGM, Health Connect) | ✗ needs a device build |
| 2 | Recipe management | ✗ |
| 3 | Water + water sync | ~ water yes, sync no |
| 4 | **Don't break my UI / let me revert** | n/a — but a warning for us |
| 5 | Search my own diary history | ✗ |
| 6 | Micronutrients / custom nutrients | ~ fibre only |
| 7 | Fibre and net carbs in the diary | **✓ spec 0015** |
| 8 | **Adaptive TDEE** | **✓ spec 0010** — the #1 named gap vs MacroFactor |
| 9 | Copy previous day / repeat | **✓ specs 0011 + 0014** |
| 10 | Public API / data export | ~ CSV export |
| 11 | Meal planner | ✗ |
| 12 | Scan the nutrition label | ✗ Phase 2 |
| 13 | Recents surfaced first in search | **✓ go-tos** |
| 14 | Voice / widget / watch logging | ✗ needs a device build |
| 15 | Flexible goals (min/max ranges) | ✗ |
| 16 | Dark mode | **✓** |
| 17 | Offline mode | **✓** — nobody in the category does this well |
| 18 | Symptom / supplement tracking | ✗ |
| 19 | **Turn off gamification** | ✓ by design — no popups, no interstitials |
| 20 | Family / multi-profile | ✗ |

Fuel already answers seven of the top twenty, including two — adaptive TDEE and
real offline support — that are the loudest unmet requests in the category.

## What this says to build next

1. **A legitimate low-effort mode.** Highest-evidence item on this page, and
   nobody ships it. It must be a first-class logging state, not a degraded
   one, and the user must be able to drop into it and back out.
2. **Time-of-day predictive logging.** MacroFactor's Hourly Go-Tos: the app
   learns what you eat *at this hour* and remembers your portion, so logging
   gets cheaper the longer you use it. It is the only mechanic where
   accumulated history literally reduces daily effort — which builds the exact
   switching cost that keeps multi-year users.
3. **A month-7 re-entry path.** Resume without a streak reset, without a
   backfill demand, and without a verdict on the first screen — because
   information avoidance is the measured predictor of decline.
4. **Make "3+ days this week" the celebrated unit**, not an unbroken chain.

## Where these live (so we don't repeat the bolt-on mistake)

| Feature | Home |
|---|---|
| Low-effort mode | the log sheet + a Today empty-state affordance |
| Hourly go-tos | the log sheet — it *replaces* the current go-tos list |
| Month-7 re-entry | the single moment slot on Today |
| "3+ days this week" | Progress → Week |
| Reminders | You → settings, with quiet hours in onboarding |
| Recipes / meal planner | a future Foods surface, not Today |

## Caveats, stated

Reddit was unreachable from the research environment, so no Reddit sentiment
is included. App Store reviews are algorithmically surfaced, not a
distribution. Lose It's AI-logging claims (3.5× faster, 6% more weight loss)
are an unmethodologied press release. No study was found on optimal timing or
frequency for food-logging reminders specifically.
