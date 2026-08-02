# Spec 0013 — Rest days: a streak that survives one missed day

## Restatement

The churn literature is unambiguous about how people leave a food tracker
(`docs/research/0002`, §1). Cordeiro et al. name the cascade in users' own
words: one day gets missed → the summary is now wrong → the feedback is
useless → logging feels pointless → gone. Only **23%** of people who quit did
so because they reached their goal. Re-engagement succeeds about a third of
the time, so a break prevented is worth roughly two breaks repaired.

Fuel's streak currently resets to zero on a single missed day. The five-day
simulation caught exactly this: Ravi's 3-day run vanished after one sick day
and the app greeted him as a beginner. The comeback card (spec: narrative)
softened the landing; this removes the fall.

Yazio's earned **Streak Freeze** is the most humane mechanic shipped by anyone
in this category. This is Fuel's version, with one hard rule added.

## The hard rule: never claim they logged

A rest day protects the run. It does NOT become a logged day. Everywhere the
app shows a rest day it shows it as a rest day — the week strip draws it
distinctly, the streak card says how many were used, and the day count is of
days actually logged. An app that quietly rewrites a missed day as a logged
one has lied to the person about their own life, and every number downstream
inherits the lie.

## Behaviour

- Logging **7 consecutive days** earns one rest day. Maximum **2** banked.
- A gap of exactly one day is covered automatically by a banked rest day, if
  one is available. The run continues; the rest day is spent.
- A gap of two or more days breaks the run. Banked rest days are **kept** —
  they were earned, and taking them away at the moment someone is already
  returning from an absence would be exactly the wrong instinct.
- Rest days are derived purely from the logged-day list, not stored. That
  means they survive sign-out, device change and a server restore, and there
  is no state to get out of sync.

## UI mapping

- **Streak card (Today)** — value unchanged (days actually logged in the run).
  Suffix gains the rest-day case: `3 days · 1 rest day`.
- **Week strip** — a covered day gets its own `rested` dot state, distinct
  from both logged and missed.
- **After the save** — the day a user returns and finds their streak intact,
  the comeback card says so plainly rather than silently absorbing it.

## Case grid

| Case | Expected |
|---|---|
| 6-day run, no miss | 6, 0 banked (7 not reached) |
| 7-day run | 7, 1 banked |
| 14-day run | 14, 2 banked |
| 21-day run | 21, 2 banked (cap holds) |
| 7 days, miss 1, log again | run continues; 1 rest spent, 0 banked |
| 7 days, miss 2 | run breaks; 1 rest still banked |
| 7 days, miss 1, then miss 1 again | second miss breaks it — nothing left to spend |
| 14 days, miss 1, log 1, miss 1, log | both covered; run intact; 0 banked |
| miss 1 with 0 banked | breaks, exactly as today |
| today unlogged, yesterday logged | alive and unspent — an ordinary morning is not a miss |
| today unlogged, one day missed before it, 1 banked | alive, rest day spent on the missed day |
| 2 years of daily logs | banked never exceeds 2; runs in well under the perf budget |

## Out of scope

- Buying, gifting or restoring rest days. Cal AI sells a $0.99 "Streak
  Restore", which charges people to relieve anxiety the product manufactured.
  Fuel will not monetise this, now or later.
- Notifying someone that a rest day was spent while they were away. That needs
  a notification layer Fuel does not have.
