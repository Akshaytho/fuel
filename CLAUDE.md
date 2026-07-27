# Fuel — AI context file (read this first, every session)

Fuel is a global nutrition-tracking app (iOS + Android, React Native + Expo).
Solo founder (Harish) + Claude. Production-grade quality bar. This file is the
session-independent memory: follow it exactly; when in doubt, it wins over
your instincts.

## The workflow (non-negotiable)

Every work session follows the loop in `docs/playbook.md`:

0. PHASE GATE (Harish's standing rule): a task/phase is done only when its
   UI matches the extracted design screen AND every function in it works.
   Never advance to the next item while known half-work exists — finish it
   or get Harish's explicit OK to defer (logged in TASKS.md).
1. Read `CLAUDE.md`, `docs/TASKS.md`, and the relevant `docs/features/*.md` spec.
2. Do ONE unchecked task from TASKS.md — only that task.
3. For new features: write/extend the spec FIRST (restatement, UI mapping,
   behavior table, case grid, out-of-scope, open questions) and get approval
   before code.
4. Write tests from acceptance criteria before or alongside code.
5. Before claiming done: run `pnpm verify` and show real output; walk the
   spec's case grid; adversarial self-review (find ≥5 problems); fix; re-run.
6. Update `docs/TASKS.md` checkboxes, commit with a conventional message.
   Never leave work uncommitted at session end.

## Architecture (locked — see docs/adr/, do not relitigate)

- Monorepo: pnpm workspaces. `packages/domain` (pure TS business logic, zero
  deps), `packages/tokens` (design tokens), `apps/mobile` (Expo app).
- Client: React Native + Expo (ADR-001). TypeScript strict everywhere (ADR-002).
- Backend: Supabase (Postgres + RLS default-deny) (ADR-010/012). The app never
  holds third-party secrets; those live in Edge Functions (ADR-027).
- Offline-first: local SQLite is source of truth for the UI; sync queue in
  background; idempotency via client_id (ADR-008).
- AI parses STRUCTURE only (items + quantities); nutrition NUMBERS always come
  from the food database. Estimates are labeled and editable (ADR-016).
- Food lookups are cache-first into our own DB (ADR-015).
- Subscriptions via RevenueCat (ADR-020). Analytics/flags via PostHog,
  errors via Sentry (ADR-022/023).

## Code rules

- NO raw hex colors, px values, or font names in app code — design tokens from
  `packages/tokens` only (ADR-005). New color = update tokens, never inline.
- NO dead controls: every interactive element works or is explicitly marked
  `// TODO(stub): <task-id>` and flagged in the session report.
- All user-facing strings go through i18n (ADR-029) — no hardcoded English
  in components (scaffold pending; until then collect strings in a
  strings.ts per screen).
- `packages/domain` stays pure: no React, no IO, no platform imports. All
  nutrition math lives there and is unit-tested.
- DATA LIVES IN DATABASES, NEVER IN CODE (Harish's standing rule): no food
  names, no content lists, no seed JSON checked into the repo. Pipelines
  FETCH from sources and WRITE to the database. Demo/stub data in app code
  is temporary by definition and must be removed by the task that replaces
  it (tracked in TASKS.md).
- Every module boundary validates with types; external data validates with Zod.
- Units: canonical internal units are grams, ml, kcal. Display conversion
  happens at the UI edge only.
- Errors: throw typed `DomainError` subclasses in domain; never throw strings.

## Commands

- `pnpm verify` — typecheck + all tests. Must be green before any commit.
- `pnpm -C packages/domain test` — domain tests only.

## Design source of truth

`design/` holds the design doc. The production visual direction is "Native"
(iOS system palette); the PRODUCTION LAYOUTS are the turn-4 "complete
production flow" screens (Summary, Log sheet, etc.) — later turns 5/6 build
on them. RULE (added after P1-02 fidelity miss): before building ANY screen,
extract and screenshot the exact design screen (tools/visual-harness has the
extractor pattern) and put it side-by-side with the build in the harness.
Fidelity acceptance = element-by-element comparison against that screenshot,
never against memory of the palette.

## When you (Claude) make a mistake

Diagnose why, then add a rule here or to the feature spec so the mistake
class can't recur. This file is allowed to grow; it is the project's immune
system.
