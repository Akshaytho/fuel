# Fuel — task state (the file that remembers)

Rules: one session works one unchecked box. Mark `[x]` only when
`pnpm verify` is green and the playbook verification gate passed.
Add newly discovered work as new boxes — never do it silently.

## Phase 0 — Foundations

- [x] P0-01 Repo + pnpm workspace + strict tsconfig + gitignore
- [x] P0-02 CLAUDE.md + docs system (ADRs, TASKS, playbook, feature specs)
- [x] P0-03 Design tokens package extracted from design doc (light + dark)
- [x] P0-04 Domain package: nutrition engine (feature 0001) with green tests
- [x] P0-05 Expo app scaffold wired to tokens (structure only; deps install on first `pnpm install` locally/CI)
- [x] P0-06 GitHub Actions CI: install → typecheck → test
- [ ] P0-07 Push to GitHub (needs Harish: create repo, push bundle) — see README
- [ ] P0-08 Expo dev build runs on a phone (Expo Go): Today screen shell renders with tokens
- [ ] P0-09 Storybook (or expo-router sandbox screen) for core components
- [ ] P0-10 Supabase project (staging) + schema v1 migration + RLS policies + generated types
- [ ] P0-11 Sentry + PostHog wired (dev keys, EU hosting for PostHog)
- [ ] P0-12 i18next scaffold; strings externalized from day one

## Phase 1 — Core loop (specs first, one box per session)

- [ ] P1-01 Spec + build: core UI primitives (Ring, MacroTile, ListRow, Sheet, NavPill)
- [ ] P1-02 Spec + build: Today/Summary screen (all states: default/empty/loading/offline)
- [ ] P1-03 Spec + build: onboarding (goal-first) using domain targets engine
- [ ] P1-04 Spec + build: food search + portion sheet (local seed DB first)
- [ ] P1-05 Spec + build: offline log store (SQLite) + sync queue + idempotency
- [ ] P1-06 Food cache service: OFF + USDA seed import pipeline
- [ ] P1-07 Data export + delete-account flows (compliance, launch-blocking)

## Backlog / discovered work

- [ ] B-01 Decide minimum age / age-gate policy (Harish decision — DPDP under-18)
- [ ] B-02 Decide Fuel Pro pricing + free/paid line (Harish decision)
- [ ] B-03 Legal entity + data controller identity (Harish decision)

## Session log (append one line per session)

- 2026-07-27 · session 1 (cloud) · P0-01..P0-06 done; feature 0001 spec+tests+impl green; repo delivered as bundle.
- 2026-07-27 · session 1b (cloud) · All project docs vendored into docs/ (index: docs/README.md); SETUP.md with recovery playbook; toolchain pinned (.nvmrc, engines, .editorconfig).
