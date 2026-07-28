# Feature 0008 — Profile, data export, account deletion (P1-07)

Status: SPEC → BUILD → VERIFY (driven walkthrough + live server assertions)
Design ref: "Profile" (out/design-profile.png)

## 1. Restatement

The "You" tab per design: avatar + name + "Fueling since …", CURRENT GOAL
card with Change link, settings rows (Reminders / Units / Apple Health /
Export my data · CSV), Help & FAQ, red Sign out, footer "Fuel 1.0 · your
data stays yours". COMPLIANCE ADDITION (not in design, required by
GDPR/DPDP — recorded here): red "Delete account & data" row beneath Sign
out, two-step confirm, erases server data AND auth account, then local.

## 2. Decisions

- Export per design: CSV of all log entries (client fetches OWN rows via
  RLS) + profile summary as leading `#` comment lines. On device: system
  share sheet; in harness: content surfaced for assertion.
- Delete: Supabase Edge Function `delete-account` (service role), verifies
  the caller's JWT, deletes log_entries/weigh_ins/entitlements/profile/auth
  user. Client then wipes local kv + store and returns to Welcome.
- Sign out: clears session only; local data stays for re-login (recorded).
- Reminders/Units/Apple Health rows: honest coming-soon (P3 notifications,
  backlog units/imperial P0-12+, Apple Health P2+) — alerts state it.
- "Change" goal → re-runs onboarding goal→about→plan flow (reuses screens).

## 3. Case grid

| Case | Verify |
|------|--------|
| You tab opens Profile per design (goal card shows real targets) | walkthrough |
| Export: CSV contains every logged entry + profile lines | walkthrough assert content |
| Export with zero entries still yields valid CSV (headers) | walkthrough |
| Delete: first tap asks confirmation; cancel keeps everything | walkthrough |
| Delete confirmed: server rows GONE + auth user GONE (live assert) | post-script vs admin API |
| After delete: app at Welcome; local store empty | walkthrough |
| Sign out returns to Welcome, session cleared | walkthrough |
| Every row fires (coming-soon rows honest) | walkthrough |

## 4. Acceptance

AC1 Edge function deployed + rejects requests without valid JWT (401).
AC2 Walkthrough green incl. live delete verified server-side.
AC3 Screens side-by-side vs design-profile.png; pnpm verify; bundle exports.
