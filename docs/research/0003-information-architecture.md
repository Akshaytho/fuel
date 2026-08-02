# Research 0003 — Where each thing belongs

Written after Harish's note: *"why are you adding all features into one screen"*.
He is right. Every feature this month landed on Today because that is where the
user is. This is the audit, the evidence, and the proposal.

## 1. What Today actually carries now

Enumerated from `TodayScreen.tsx`, not from memory:

| Block | Shows when |
|---|---|
| Header (date · Day N · Summary · avatar) | always |
| Sync pill | not synced |
| Nutrition card (rings + 3 stat blocks) | logged day |
| Coach strip | logged day |
| Rest-day note | a rest day was used |
| Comeback card | returning after a gap |
| Fibre strip | logged day |
| Streak card | logged day |
| Water card | logged day |
| Week strip (7 dots) | always, once there is history |
| TODAY'S MEALS list | logged day |
| Celebration overlay | targets land |

**Up to 9 blocks compete on a logged day.** Measured on a real account at
390×890: 1,065 px of content, and that was a day with only one of the
conditional cards showing.

## 2. What the field does (docs/research/0003 sources below)

| | MyFitnessPal | Lose It | Cronometer | MacroFactor | Yazio | Lifesum | Cal AI |
|---|---|---|---|---|---|---|---|
| Weekly view | Progress tab | Profile→Insights | Discover | Dashboard widget | Analysis | Progress | separate |
| Streaks | **home** | — | Discover | Insights sheet | — | — | **home** |
| Insights/reports | Progress | Profile | Discover | own section pages | Analysis | Progress | separate |
| Micronutrients | Progress | — | tap a bar → report | pin ≤8 | — | — | — |
| Coaching | **Coach tab** | — | — | Strategy | — | inline | — |
| Settings | avatar, top-right | Profile, top-right | More tab | More | Profile | — | Profile |

Three things stand out:

1. **Every app without exception moves micronutrients off home.** Fuel put the
   fibre strip on Today. That is the odd one out.
2. **Only MyFitnessPal and Cal AI put streaks on home** — the two most
   gamified, and MFP is the one whose home-screen rewrite collapsed.
3. **Five of seven demoted settings out of the tab bar** into a top-right
   avatar, buying a tab slot for something more useful.

### The cautionary tale, in numbers

MyFitnessPal v26.16.0 (21 April 2026) replaced the Diary tab with a
card-based Today tab. **Version rating fell 3.24 → 1.54 stars.** The named
complaints were not about the cards being ugly:

- "the diary has been ruined by being converted to a list of gigantic,
  space-consuming cards"
- "the food diary is now buried behind a 'View All' button"
- "takes more taps to see what I have eaten for a meal"

MFP's stated goal was "fewer taps and less friction." It shipped the
opposite. **The lesson for Fuel is precise: whatever else moves, today's meal
list must not get further from the user.**

### The principles worth encoding

- **Material:** 3–5 top-level destinations.
- **Apple HIG:** tabs are for major areas, not actions; tabs must stay stable.
- **NN/g progressive disclosure:** "designs that go beyond **2 disclosure
  levels** typically have low usability because users often get lost." Also:
  presence on the initial display *signals importance* — so putting fibre next
  to calories tells the user they rank equally, which is false.
- **MacroFactor's stated architecture**, the clearest articulation anyone
  publishes: *"The primary dashboard is an at-a-glance view and launch point…
  Each section has its own dedicated page."*

## 3. Two structural faults in Fuel, beyond the crowding

**(a) Trends and Report are two tabs answering one question.** Every
competitor has exactly one "how am I doing over time" destination — Progress,
Discover, Insights, Analysis. Fuel has two, and neither is complete on its own:
Trends has the charts, Report has the verdict and the target proposal.

**(b) The avatar and the You tab go to the same screen.** Two navigation
affordances, one destination — a wasted tab slot, and exactly the
top-right-avatar pattern five of seven apps use to *free* a slot.

## 4. The proposal

### Tabs: `Today` · `Progress` · `Foods` · `You` + centre ⊕

`Trends` + `Report` merge into **Progress**, segmented Week / Weight / Energy /
Consistency. The freed slot becomes **Foods** — the user's own food world
(go-tos, meals they repeat, recently logged), which today is buried inside the
log sheet where it is only reachable while logging.

### Today keeps only what answers "how am I doing right now?"

1. Header — date, Day N, **streak as a small chip**, avatar
2. **Nutrition card** — the hero. Tappable → detail sheet
3. **One moment slot** — at most ONE of: coach line, comeback, rest-day note
4. **Water** — a slim row, because it is a daily *action*
5. **TODAY'S MEALS** — the diary, and it moves *up*, not down

Five blocks. Nothing more than one tap deep.

### What moves, and where

| Today loses | Goes to | Why |
|---|---|---|
| Fibre strip | Nutrition detail sheet (one tap on the card) | every competitor keeps micronutrients off home; adjacency to calories overstates its rank |
| Streak card | header chip + Progress → Week | present, not competing; the apps that promote streaks are the gamified ones |
| Week strip | Progress → Week | it is a multi-day view, and multi-day belongs in Progress everywhere else |
| Comeback / rest note as separate cards | the single moment slot | they are moments, not furniture, and never need to co-exist |
| Meals you repeat (log sheet only) | **Foods** tab, still in the log sheet | discoverable outside the act of logging |

### The rules this establishes

1. **Today may hold at most 5 blocks.** A new feature does not get added to
   Today; it displaces something or it lives elsewhere.
2. **At most one moment at a time.** Never two banners.
3. **Two disclosure levels, never three** (NN/g).
4. **Today's meals never moves further away.** MFP's mistake is not repeatable.

## Built, and the two consequences worth reviewing

Today and Progress are built and proven (`ia-today-check.mjs`,
`dark-mode-check.mjs` now covering 16 screens). Measured before and after, on
a real account at 390×890:

| | before | after |
|---|---|---|
| Blocks on Today | 9 possible / 7 rendered | **5** |
| Content height | 1,065 px | **844 px** |
| Where TODAY'S MEALS starts | 705 px | **450 px** — above the fold |

Two consequences I did not plan for, both worth a decision:

1. **Logging a weigh-in is one tap deeper.** Progress opens on Week, so
   weight is Progress → Weight → + Log weight. Weighing is a frequent action;
   if this bites, the fix is a weigh-in affordance in the Week segment.
2. **The + button is no longer centred.** With three destinations the bar is
   Today · Progress · ⊕ · You, which puts ⊕ at 62% across rather than 50%.
   Options: accept it, float ⊕ above the bar, or restore a fourth destination
   (which is what the Foods tab would have been).

## 5. Open questions for Harish

- Water on Today, or into the nutrition detail sheet? It is a daily action, so
  I lean to keeping it, but it is the weakest of the five.
- Streak as a header chip, or off Today entirely? The evidence mildly favours
  removing it; the chip is the compromise.

## Sources

MyFitnessPal: support.myfitnesspal.com Today tab / Progress Overview / Coach
articles; mwm.ai v26.16.0 rating analysis; piunikaweb.com; consumerrights.wiki.
Cronometer: support.cronometer.com Mobile Diary Overview / Mobile Display /
Mobile Dashboard; cronometer.com/blog/our-new-look.
MacroFactor: help.macrofactorapp.com Get to Know Your Dashboard;
macrofactor.com/dashboard-customization.
Lose It: loseit.zendesk.com How to Log Food / Removal of the Insights Tab.
Yazio: help.yazio.com Tutorial of the Yazio app.
Lifesum: help.lifesum.com Progress & Statistics; App Store listing.
Cal AI: screensdesign.com/showcase/cal-ai-calorie-tracker.
Principles: m1.material.io bottom navigation; nngroup.com/articles/progressive-disclosure.
