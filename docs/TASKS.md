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
- [x] P0-07 Pushed to GitHub: https://github.com/Akshaytho/fuel (CI on every push)
- [ ] P0-08 App shell boots (spec 0002) — code DONE + bundle export verified; remaining: Harish confirms render on phone in Expo Go (light+dark)
- [ ] P0-09 Storybook (or expo-router sandbox screen) for core components
- [x] P0-10 Supabase LIVE: schema v1 applied to project wccxzcrxdcqvprswdvlu via Management API; all 6 tables verified column-exact, RLS enabled, policies correct, tables empty; anon key fetched to .env. NOTE: project contains ~22 legacy tables from Harish's earlier "the-system" experiment (quests, exercise_plan, stats_snapshot…) — left untouched; see B-07
- [ ] P0-11 Sentry + PostHog wired (dev keys, EU hosting for PostHog)
- [ ] P0-12 i18next scaffold; strings externalized from day one

## Phase 1 — Core loop (specs first, one box per session)

- [x] P1-01 Core UI primitives (spec 0003): Ring, MacroTile, ListRow, Card, NavPill — 35 tests green; visually verified light+dark via headless-Chromium harness (tools/visual-harness)
- [x] P1-02 Today screen v1 (spec 0004) — states/logic verified BUT layout diverges from production Summary design (caught by Harish's review)
- [x] P1-02b FIDELITY REBUILD done: TripleRing, TabBar, StatCard, CoachStrip, ActionRow components; TodayScreen matches production Summary (normal/empty-Day1/dark verified side-by-side vs extracted design refs; loading/over/offline as coherent derivatives). Polish later: real line icons instead of emoji in empty-state rows
- [ ] P1-03 Spec + build: onboarding (goal-first) using domain targets engine
- [ ] P1-04 Spec + build: food search + portion sheet (local seed DB first)
- [ ] P1-05 Spec + build: offline log store (SQLite) + sync queue + idempotency
- [ ] P1-06 Food cache service: OFF + USDA seed import pipeline
- [ ] P1-07 Data export + delete-account flows (compliance, launch-blocking)

## Backlog / discovered work

- [ ] B-01 Decide minimum age / age-gate policy (Harish decision — DPDP under-18)
- [ ] B-02 Decide Fuel Pro pricing + free/paid line (Harish decision)
- [ ] B-03 Legal entity + data controller identity (Harish decision)
- [ ] B-04 v2 pillar modules: training/hypertrophy, mobility & joints, rest/recovery (docs/product/vision-notes.md)
- [ ] B-05 "Solo leveling" gamification layer design — levels/streaks across all pillars (vision-notes.md)
- [ ] B-06 SECURITY: rotate Anthropic API key (exposed in photo/chat; unused so far); strengthen DB password + rotate JWT secret + rotate sbp_ access token before launch
- [ ] B-07 Legacy "the-system" tables in Supabase (agent_runs, quest_defs, exercise_plan, stats_snapshot, etc.): decide keep-as-reference vs drop; some may seed v2 pillar design (vision-notes.md)

## Session log (append one line per session)

- 2026-07-27 · session 1 (cloud) · P0-01..P0-06 done; feature 0001 spec+tests+impl green; repo delivered as bundle.
- 2026-07-27 · session 1b (cloud) · All project docs vendored into docs/ (index: docs/README.md); SETUP.md with recovery playbook; toolchain pinned (.nvmrc, engines, .editorconfig).
- 2026-07-27 · session 1c (cloud) · P0-07: pushed to github.com/Akshaytho/fuel via fine-grained PAT (deploy key unusable from cloud sandbox — SSH blocked; noted in SETUP context).
- 2026-07-27 · session 1d (cloud) · P0-08 spec 0002 written; entry/babel/metro monorepo glue built; expo export caught .js-extension import bug in domain (fixed, 30 tests still green); iOS bundle exports clean. Awaiting on-phone confirmation.
- 2026-07-27 · session 1e (cloud) · P1-01 done: @fuel/ui primitives built spec-first; visual harness (react-native-web + esbuild + Playwright/Chromium) catches rendering; fixed missing-ring bug (.web.js platform extensions) + ADR-005 violation (raw hex in NavPill → new onTint/shadow tokens).
- 2026-07-27 · session 1f (cloud) · Vision notes captured (solo-leveling multi-pillar v2); schema v1 + RLS written; DB push from sandbox blocked (proxy is HTTPS-only — raw Postgres impossible); .env local-only, .env.example committed. Next: Management API token OR laptop db-push.
- 2026-07-27 · session 1g (cloud) · P0-10 DONE: schema v1 live on Supabase via Management API (sbp token from Harish); tables/columns/RLS verified against migration; anon key in local .env; legacy the-system tables discovered and preserved (B-07).
- 2026-07-27 · session 1h (cloud) · P1-02 done via full loop: spec 0004 → domain mealForHour (12 tests) → screen slices → verify. Review caught: over-target demo not actually over (fixed), zero-progress ring dot (fixed in Ring), missing @fuel/ui dep in app (caught by bundle export).
- 2026-07-27 · session 1i (cloud) · Harish review caught layout divergence from production Summary; design-screen extractor added; CLAUDE.md rule: screen builds must verify against extracted design screenshot side-by-side. P1-02b opened.
- 2026-07-27 · session 1j (cloud) · P1-02b: screen rebuilt to production design per new CLAUDE.md rule; review fixes: meal rows under tab bar (scroll padding), StatCard wrap. 47 tests green, bundle exports clean.
