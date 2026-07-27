# Feature 0007 — Onboarding + the connected journey (P1-03)

Status: SPEC → BUILD → VERIFY (driven end-to-end journey + live auth/sync)
Design refs: Welcome / Onboarding goal / Onboarding about you / Your plan
(out/design-onboarding.png)

## 1. Restatement (Harish's user-journey lens)

Day 1: open app → Welcome (brand, three promises, sign-in) → goal → four
numbers + honest activity → YOUR computed plan → Start Day 1 → Day-1 Today.
Day 180: open app → straight to Today, targets theirs, data theirs, entries
synced to their account. No dead ends, no demo anything.

## 2. Flow state machine (app root)

boot → session? profile?
- no profile → onboarding (welcome → goal → about → plan) → save → today
- profile, no session → today (local mode; sign-in reachable via profile)
- profile + session → today + background sync

## 3. Decisions (recorded)

- AUTH: email+password via Supabase REST works TODAY and is fully
  verifiable → built now (small sheet styled with our components; email
  path is in the design's "Use email instead"). Apple/Google buttons render
  per design but alert "coming soon" — they REQUIRE Harish's Apple/Google
  developer accounts (backlog B-09, needs Harish). No fake buttons: the
  alert states it plainly.
- Plan numbers come from OUR domain engine (spec 0001) — the design's
  "2,050" is illustrative sample data, not a formula to copy.
- Water target: 35 ml/kg rounded to nearest 0.25 L (domain, tested).
- Weekly-rate copy per goal from strings.
- Daily-reminder toggle: state persisted; actual notification is P3
  (marked on the row's TODO).
- Profile persists locally (kv) AND upserts to Supabase profiles when
  signed in. Entry PULL on fresh device: backlog P1-05b (push-first v1).

## 4. Case grid

| Case | Verify |
|------|--------|
| Fresh launch → Welcome renders per design | walkthrough + screenshot |
| Apple/Google → honest coming-soon; email → auth sheet | walkthrough |
| LIVE signup/signin against Supabase from the journey | walkthrough (real network) |
| Goal cards select exclusively; Continue advances | walkthrough |
| About-you inputs accept values; activity radio exclusive | walkthrough |
| Plan shows domain-computed kcal/macros/water for entered numbers | walkthrough assert exact |
| Start Day 1 → Day-1 empty Today | walkthrough |
| RELOAD (relaunch) → skips onboarding, straight to Today | walkthrough |
| Log a food while signed in → row lands in LIVE log_entries | post-walkthrough DB assert |
| Invalid inputs (age 0, empty) → Continue disabled | walkthrough |
| Dark mode all four screens | screenshot |

## 5. Acceptance

AC1 Journey walkthrough (interact-journey.mjs) all steps green, incl. live
    auth + live sync assert + relaunch persistence.
AC2 Side-by-side vs design refs reviewed; deviations listed or fixed.
AC3 pnpm verify green (incl. new domain water test); bundle exports.
AC4 App root wired identically (sqlite kv); no demo data anywhere.
