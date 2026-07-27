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
- [x] P1-02b FIDELITY REBUILD done: TripleRing, TabBar, StatCard, CoachStrip, ActionRow components; TodayScreen matches production Summary (normal/empty-Day1/dark verified side-by-side vs extracted design refs; loading/over/offline as coherent derivatives).
- [x] P1-03 Onboarding + connected journey (spec 0007): Welcome/Goal/AboutYou/Plan built to design; LIVE email auth (Supabase); profile persists local+remote; 10-step driven journey ALL PASS (signup→plan exact domain numbers→Day-1→live-search log→relaunch persistence); logged entry verified in LIVE log_entries. Apple/Google sign-in = B-09 (needs Harish dev accounts)
- [x] P1-04 Log flow (spec 0005): LogSheet + SearchScreen + PortionSheet match design (side-by-side verified, light+dark); LIVE search proven vs Supabase (scripts/check-search.py); portion math live via domain; macro tokens corrected to production mapping (protein orange/carbs purple/fat blue). Stubs marked: Scan/Describe/Label→P2, Saved/Edit-food→backlog, Copy-yesterday→P1-05
- [x] P1-05 Offline store + sync (spec 0006): @fuel/store (9 unit tests: instant add, crash recovery, retry, ordering); LIVE integration proof (idempotent replay=1 row, RLS isolation, e2e users) via check-sync.py; 16-step driven-UI walkthrough ALL PASS (every screen control clicked+asserted, offline round-trip); app wired to expo-sqlite kv store, demo data DELETED. Remote sync attaches at P1-03 (needs auth user)
- [ ] P1-06 Food seed: pipeline BUILT+PROVEN (600 USDA foods live in DB, search verified; zero data in repo). Remaining for done: full ~8,000-food run — blocked on valid USDA key (photo key invalid; demo key rate-limited). Then OFF barcode layer (with P2 scan)
- [ ] P1-07 Data export + delete-account flows (compliance, launch-blocking)

## Backlog / discovered work

- [ ] B-01 Decide minimum age / age-gate policy (Harish decision — DPDP under-18)
- [ ] B-02 Decide Fuel Pro pricing + free/paid line (Harish decision)
- [ ] B-03 Legal entity + data controller identity (Harish decision)
- [ ] B-04 v2 pillar modules: training/hypertrophy, mobility & joints, rest/recovery (docs/product/vision-notes.md)
- [ ] B-05 "Solo leveling" gamification layer design — levels/streaks across all pillars (vision-notes.md)
- [ ] B-06 SECURITY: rotate Anthropic API key (exposed in photo/chat; unused so far); strengthen DB password + rotate JWT secret + rotate sbp_ access token before launch
- [ ] B-08 Launch decision: keep or drop anon read on foods (migration 0003)
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
- 2026-07-27 · session 1k (cloud) · Phase-gate rule adopted (no advancing with half-work); P1-02b polish closed: real line icons (Scan/Chat/Flame) replace emoji in empty-state rows.
- 2026-07-27 · session 1l (cloud) · Data-in-DB-only rule adopted; migration 0002; seed pipeline live — 600 foods loaded via DEMO_KEY before rate limit; real USDA key needed (photo transcription invalid).
- 2026-07-27 · session 1m (cloud) · P1-04 done full loop: design extraction → spec 0005 → token correction → components (Sheet/SearchField/IconTile/FoodRow/SelectChip/MacroPreviewTile/CTA) → 3 screens → live search check green → screenshots reviewed (fixed Saved tile tint, meal-chip row). USDA key slot reserved in .env; 600-food table in use.
- 2026-07-27 · session 1n (cloud) · P1-05 done: store package + live DB proof + Playwright-driven walkthrough (16/16) incl. offline log→pending→sync-clears; testIDs added to interactive controls (world-class verification per Harish); app store-wired, bundle exports.
- [ ] B-09 Apple + Google sign-in (needs Harish: Apple Developer + Google Cloud accounts; buttons live with honest coming-soon until then)
- [ ] B-10 Launch: re-enable email confirmations (mailer_autoconfirm=true set for staging)
- [ ] P1-05b Entry PULL on fresh device/sign-in (push-first v1; server has the data)
- 2026-07-27 · session 1o (cloud) · P1-03 done: journey harness runs the REAL AppRoot (same component as device) with live Supabase (curl bridge for sandbox Chromium); 10/10 journey steps green; DB-side entry verified. New-user→returning-user loop closed.
