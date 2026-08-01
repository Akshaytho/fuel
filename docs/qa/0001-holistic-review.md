# QA 0001 — Holistic review (independent QA persona), 2026-08-01

Reviewer: independent principal-QA subagent, fresh eyes, adversarial brief.
Method: identify the connecting concepts all features share, then hunt the
defects living BETWEEN features. 14 defects → 6 root causes → all fixed the
same session. This file preserves the findings and the proof of each fix.

## The six connecting concepts

1. **What day is it** — drives logging, Today, Trends, streaks, export.
2. **Who owns this device's data** — auth session vs local stores.
3. **The user's current body/targets** — onboarding snapshot vs fresh weigh-ins.
4. **Has this data reached the server** — synced flags, push-only sync.
5. **Shape of persisted data across versions** — old bytes read by new code.
6. **Is the session alive** — one boot refresh vs an hour-long token.

## Root causes → defects → fix → proof

**RC-4 · Persisted schema evolved with no validation on read** (D-2 crash,
D-7 eternal Day 1, D-13 eternal splash). Fix: `packages/store/src/migrate.ts`
— the single validated boundary between disk bytes and typed memory; every
adapter and the boot plan-read go through it; boot gained a catch-all.
Proof: 15 migration tests incl. the literal crash reproduction (`cap(meal)`
on a pre-B-12 row) and 7 corruption blobs; `pnpm -C packages/store test`.

**RC-6 · Session treated as a boot-time constant; auth errors conflated**
(D-9 retry-can-never-succeed, D-14 network-failure-as-wrong-password).
Fix: `refresh()` falls back to the kv-persisted refresh token;
`authedFetch` recovers a null in-memory session; sign-in errors branch on
network-vs-credential before the sign-up probe.
Proof: typecheck + journey auth path; the restore step (below) exercises
authedFetch GETs immediately after a fresh sign-in.

**RC-5 · Server mutations were best-effort while the UI claimed success**
(D-3 deletion skipped server on dead session, D-10 fire-and-forget profile,
D-11 local-only water undo). Fix: delete-account is server-first — it
throws before any local wipe, so "erased" is never claimed unconfirmed;
profile upsert is a kv dirty-flag retried inside every `runSync`; water
undo issues a server DELETE and restores the local entry if it fails.
Proof: journey delete step (server 200 then welcome; sign-in-after-delete
400 verified live in session 5); unit tests for removeLast/restore.

**RC-3 · The onboarding snapshot was forever-truth** (D-4 frozen targets
under an "adapts" label, D-8 blank re-onboarding trap). Fix: every weigh-in
recomputes targets + water goal from current weight and re-syncs the
profile; change-goal prefills all fields from the stored profile and gains
a Cancel; copy corrected to "adapts as you log weight".
Proof: journey step "D-4" — weigh in 60.0 kg by tapping, return to Today,
the calorie target VISIBLY drops 1,553 → 1,463 (hand-computed:
BMR 1330.25 × 1.375 − 20% = 1463.3) and the profile card shows 1,463 kcal.

**RC-2 · Screen state invalidated by a hand tick, not its real inputs**
(D-5 yesterday-after-midnight, D-12 "log your first weight" over a year of
history). Fix: a 30-second day-rollover check bumps the vm when the local
day changes; the weight window anchors to the LAST weigh-in, not today, so
a pause never erases history from view.
Proof: rollover covered by the device-shape harness's clock-advance
relaunch step (entry survives UTC rollover); window fallback exercised by
lifespan personas; journey Trends steps green.

**RC-1 · Device data was not bound to the account that produced it**
(D-1 cross-account leak on shared phones, D-6 write-only sync = fake Day 1
on a new phone). Fix: sign-out flushes pending, refuses to proceed if
anything would be lost, then wipes every local store and key; sign-in pulls
profile + targets + full entry/water/weigh-in history from Postgres,
hydrates the stores as synced, and lands on Today — onboarding is skipped
entirely for a returning account.
Proof: journey steps "D-1" (after sign-out, localStorage is empty and the
app is at Welcome) and "D-6" (sign back in with the same tapped email →
straight to Today, the logged Dinner entry restored from the server, the
ADAPTED 1,463 target restored — no onboarding, no Day-1 reset).

## Verification totals after all fixes

- 161 unit tests green (domain 101, store 48+, ui 12)
- Tap-only journey: 31/31 steps green (grew from 28 — the three new steps
  ARE the D-4/D-1/D-6 proofs)
- Device-shape harness: 8/8 green
- `pnpm verify` (typecheck incl. app + all suites): green
