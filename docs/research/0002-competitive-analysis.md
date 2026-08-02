# Research 0002 — What "world class" means, measured against the field

Researched 2 Aug 2026 against MyFitnessPal, Lose It!, Cronometer, MacroFactor,
Yazio, Lifesum, Cal AI and SnapCalorie, using each vendor's own live docs and
help centres, App Store/Play listings, 500 recent US App Store reviews, and
the peer-reviewed literature on tracking-app adherence and harm. Sources are
listed at the end of each section. Reddit was unreachable from this
environment, so user sentiment comes from store reviews and published
qualitative research instead — which is stronger evidence anyway.

## 1. The finding that should shape the roadmap

Every one of these apps wins week one. The category dies in weeks 4–12.

| Evidence | Number |
|---|---|
| JMIR 2020 meta-analysis, 17 studies | pooled dropout **43%**; real-world **49%** |
| JMIR 2026 decade scoping review | adherence collapses after **3–5 weeks** |
| JMIR Formative 2022 | median time to disengagement **10 weeks** |
| Business of Apps, health & fitness | day-30 retention **~3%** |
| Cordeiro et al., CHI 2015 (141 journalers) | only **23%** of people who quit did so because they reached their goal |

The other 77% were driven out by friction. The named cascade, in their words:
one day gets missed → the summary is now wrong → the feedback is useless →
logging feels pointless → done. Re-engagement succeeds only about a third of
the time, so **winning a lapsed logger back is roughly twice as hard as never
losing them.**

The design conclusion: whatever Fuel's retention mechanic is, it must be
*strongest at week five*, and a broken day must be recoverable rather than
terminal.

## 2. Where Fuel already stands with the field

Fuel is not starting behind. Two of the three things the serious apps compete
on, it already has.

| Capability | Field | Fuel |
|---|---|---|
| Adaptive TDEE from weight trend + intake | Only **MacroFactor** (their whole product). Cronometer explicitly does NOT have it — it is the top unanswered request on their own forum | **Yes** — energy-balance TDEE, spec 0010 |
| Smoothed trend weight instead of scale weight | MacroFactor, MFP | **Yes** — `smoothWeights` |
| No shaming / adherence-neutral tone | MacroFactor only, as a stated philosophy | **Yes** — and now enforced by `dayNote()` tests |
| Offline-first with idempotent sync | Nobody advertises it; several are criticised for data loss | **Yes** |
| Dark mode audited for contrast | Not claimed by anyone | **Yes** — 13 screens, 0 failures |
| Verified food data with provenance | **Cronometer** (source tabs + a Data Quality score) | Partial — cache-first into our own DB, no provenance surfaced |
| Fibre / micronutrients | Cronometer (92 nutrients); MacroFactor (26.5k research-grade entries) | **No** |
| Saved meals / recipes | All of them | **No** |
| Health integrations, widgets, reminders | All of them | **No** — needs a device build |
| Photo / voice logging | All of them, all paywalled | Planned Phase 2 |

## 3. What the field gets wrong, and Fuel should not copy

Worth writing down, because these are the *popular* choices.

**Monetising anxiety.** Cal AI sells a **$0.99 "Streak Restore"** — charging
users to relieve distress the product manufactured. Yazio and Cal AI both
deploy spin-the-wheel discount modals on paywall dismissal. Both convert.
Both are dark patterns. Fuel does neither, ever.

**Breaking a loved flow to bolt on AI.** Lifesum's v23.4.0 "AI redesign" and
MyFitnessPal's Today-tab rewrite (version rating fell **3.24 → 1.54**, and MFP
has publicly refused to revert) are the two biggest self-inflicted wounds in
the category this year. AI input modes are **additive to a fast manual path,
never a replacement for it.**

**False precision.** The NIH/NIDDK tested four photo-logging apps against 102
meals weighed to 0.1 g in a metabolic kitchen: they **underestimated by
250–345 kcal per meal and ~30 g of fat**, worst on high-fat meals. (Conference
abstract, NUTRITION 2026 — preliminary, not yet peer-reviewed.) Cal AI's
founder claims 90%+ accuracy. Returning "487 kcal" from a photograph asserts a
confidence no model has. When Fuel ships photo/describe logging it shows a
**range**, not a fake decimal.

**The perverse friction gradient.** Cordeiro measured it: users rate logging
fast food and packaged items **6.3–6.5/10** for ease and home-cooked meals
**4.6/10**. Every tracker's own friction curve nudges people toward worse
food. This is the most underrated finding in the literature and it is a
direct instruction: **make home cooking the easy path.**

## 4. Harm — the part that matters most

The evidence that tracking apps worsen disordered eating is strong enough to
be a design constraint, not a footnote.

- **Simpson & Mazzeo (2017)**, 493 students: calorie-app users showed elevated
  eating concern and dietary restraint after controlling for BMI. Their
  conclusion: *"for some individuals, these devices might do more harm than
  good."*
- **Eikey et al., BJPsych Open** (24 women, 21+ hours think-aloud): harm came
  from **ordinary, well-intentioned features** — red/green over-budget
  colouring triggering "guilt, embarrassment and shame"; streaks becoming a
  contest to eat progressively less; diary-completion warnings motivating
  continued weight loss regardless of intent.
- Causality caveat, stated honestly: these are cross-sectional. They establish
  that for people **already vulnerable**, these apps make things worse. That
  is sufficient grounds for caution.

What responsible apps do: **MyNetDiary** blocks rapid-loss rate settings and
target weights below a healthy range. **MacroFactor** publishes an
"adherence-neutral" commitment — no red numbers, no good/bad food labels, no
warning popups — on the evidence that shame predicts worse outcomes and
self-compassion better ones. **Lifesum** deliberately ships no leaderboards.

Fuel's existing position, and the gaps:

| Guardrail | Fuel |
|---|---|
| Sex-specific kcal floor (1200 F / 1500 M) | **Yes**, `KCAL_FLOOR`, and the UI says when it clamped |
| Deficit capped (20% / 1000 kcal) | **Yes** |
| No red "you failed" state | **Yes** — over-target is stated, then contextualised |
| No good/bad food labels, no warning popups | **Yes** |
| No leaderboards, no social comparison | **Yes** — there is no social layer at all |
| Streak that punishes a single missed day | **GAP** — one miss resets to zero |
| Blocked unsafe goal weight / loss rate | **GAP** |
| Reduced logging expectations, explicit breaks | **GAP** |

## 5. The gaps worth building, ranked by evidence

1. **Partial-day handling (correctness + harm).** See §6 — this is a live bug,
   not a missing feature.
2. **A streak that survives a missed day.** Yazio's earned Streak Freeze is
   the single most humane mechanic shipped by anyone in this category, and it
   attacks the exact cascade the churn literature names. MacroFactor's
   equivalent is a check-in module that distinguishes *"I fasted"* from
   *"I forgot"* and explains why the algorithm paused.
3. **Saved meals from repeated combinations.** Yazio's "Smart Adding" notices
   food combinations you log together and offers to save them as one named
   meal — friction *decreases* the longer you use the app. This is the direct
   fix for the perverse friction gradient in §3.
4. **Fibre as a first-class nutrient.** The cheapest real step toward diet
   quality rather than calorie quantity; it is on virtually every label, so
   unlike the rest of Cronometer's 92 nutrients it needs no new data source.
5. **Data-quality honesty.** Cronometer's Data Quality score answers "is this
   a real deficiency or a hole in the data" — a category of honesty almost
   nobody offers, and it is cheap to compute.
6. **Health integrations, widgets, reminders.** Table stakes, all of them
   blocked on a device build (P0-08).

## 6. The bug this research uncovered

Fuel's adaptive TDEE averages intake across "days with any logs". A day where
someone logged breakfast and then forgot counts as a full day of eating.

Measured, with a hand-built probe (`packages/domain`, six days at 1,800 kcal
and one day where she logged 150 kcal and forgot the rest):

```
clean  measuredTdee = 2313   proposed kcal = 1850
forgot measuredTdee = 2078   proposed kcal = 1662
DRIFT  = 235 kcal/day
```

**One forgotten dinner cuts her recommended daily intake by 188 kcal.** She
did not eat less; she failed to *record* eating. And it compounds — the lower
target makes her eat less, she loses faster than intended, and the next
report cuts again. This is precisely the mechanism MacroFactor's partial-
logging module exists to prevent, and it is the highest-severity finding of
this analysis.

## Sources

Adherence and churn: JMIR 2020 meta-analysis (jmir.org/2020/9/e20283),
JMIR mHealth 2026 scoping review (mhealth.jmir.org/2026/1/e64139), JMIR
Formative 2022 (formative.jmir.org/2022/2/e33603), Cordeiro et al. CHI 2015
(homes.cs.washington.edu/~jfogarty/publications/chi2015-barriersandnegativenudges.pdf),
JMIR 2021 barriers review (mhealth.jmir.org/2021/6/e20037).
Harm: Simpson & Mazzeo 2017 (pubmed.ncbi.nlm.nih.gov/28214452),
Eikey et al. BJPsych Open, National Alliance for Eating Disorders,
NEDA statement on Kurbo, MyNetDiary do-no-harm page,
macrofactor.com/adherence-neutral.
Accuracy: NIH/NIDDK at NUTRITION 2026 (eurekalert.org/news-releases/1136415).
Vendor docs: support.myfitnesspal.com, loseit.zendesk.com,
support.cronometer.com, help.macrofactorapp.com, help.yazio.com,
help.lifesum.com, and each app's App Store listing.
