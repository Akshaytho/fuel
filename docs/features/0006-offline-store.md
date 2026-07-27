# Feature 0006 — Offline log store + sync (P1-05)

Status: SPEC → BUILD → VERIFY (unit + live-DB integration + driven-UI walkthrough)

## 1. Restatement

Logging becomes real. `packages/store` (pure TS, platform-free): a LogStore
that appends entries to local storage INSTANTLY (offline-first, ADR-008),
keeps an outbox, and syncs to Supabase in the background with client_id
idempotency (schema's unique(user_id, client_id) + PostgREST
ignore-duplicates). The app wires Today + LogSheet + PortionSheet to the
store via an expo-sqlite kv adapter; demo data is DELETED (data-in-DB rule).

## 2. Architecture

- StorageAdapter interface: load()/save() — impls: in-memory (tests/harness),
  expo-sqlite kv-store (app).
- Remote interface: push(entry) — impl: PostgREST insert with
  on_conflict=user_id,client_id + Prefer: resolution=ignore-duplicates.
- LogStore: init, add (instant local), entriesForDay, pendingCount,
  sync (push unsynced in order; stop on failure; safe to re-run).
- Day summary derives from store entries via domain sumMacros.

## 3. Case grid (each row = a test)

| Case | Verify |
|------|--------|
| add() returns instantly, entry visible same tick | unit |
| entries persist across store restart (crash recovery) | unit |
| sync marks synced; second sync pushes nothing | unit |
| remote failure → entry stays pending; later sync completes | unit |
| duplicate replay (same client_id) → server keeps ONE row | LIVE integration |
| RLS: user B cannot read user A's entry | LIVE integration |
| UI: tap + on go-to → portion sheet opens | driven walkthrough |
| UI: Log CTA → summary rings/numbers update by exact kcal | driven walkthrough |
| UI: pending badge shows unsynced count; clears after sync | driven walkthrough |
| Every remaining screen control fires its handler | driven walkthrough |

## 4. Out of scope

Pull/merge from server (v1 is push-first, single device), background task
scheduling (sync on app events for now), auth UI (P1-03; integration test
uses a server-created e2e user).

## 5. Acceptance

AC1 Store unit tests green (≥8 cases above).
AC2 scripts/check-sync.py proves idempotent replay + RLS isolation on the
    LIVE database.
AC3 tools/visual-harness/interact.mjs drives the real UI (click-through)
    with assertions on on-screen numbers; before/after screenshots delivered.
AC4 App wired to store (expo-sqlite kv); demo data removed; bundle exports.
