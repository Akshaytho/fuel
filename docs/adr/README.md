# ADR ledger — locked decisions

One file per decision. Statuses: accepted | superseded-by-NNN.
Full rationale for the highest-stakes decisions lives in the numbered files;
the rest are recorded here as the ledger of record (rationale in
`docs/Fuel-SDLC-decision-lock.html` §2). Changing any ADR requires a new ADR
that supersedes it — never edit history.

| # | Decision | Choice |
|---|----------|--------|
| 001 | Framework | React Native + Expo (managed) |
| 002 | Language | TypeScript strict |
| 003 | Repo | pnpm monorepo + workspaces |
| 004 | Navigation | Expo Router |
| 005 | Styling | Design tokens; no raw values in components |
| 006 | Animation | Reanimated + Gesture Handler |
| 007 | State | TanStack Query + Zustand |
| 008 | Offline | SQLite + sync queue, client_id idempotency |
| 009 | Forms | React Hook Form + Zod |
| 010 | Backend | Supabase (managed Postgres) |
| 011 | Auth | Supabase Auth + Apple/Google + email OTP |
| 012 | AuthZ | Postgres RLS, default deny |
| 013 | API | Supabase client CRUD + Edge Functions for secrets/AI |
| 014 | Migrations | Versioned, reversible, CI-run |
| 015 | Food data | Layered OFF + USDA + commercial, cache-first into own DB |
| 016 | Meal AI | LLM parses structure only; DB provides numbers; user confirms |
| 017 | AI vendor | Abstracted gateway, model routing, spend caps |
| 018 | Barcode | VisionCamera + on-device scanner |
| 019 | Widgets | Native WidgetKit/Glance via config plugin |
| 020 | Billing | RevenueCat |
| 021 | Push | Expo Notifications |
| 022 | Analytics | PostHog (EU-hosted), flags + A/B |
| 023 | Errors | Sentry |
| 024 | CI/CD | EAS Build + EAS Update + GitHub Actions |
| 025 | Testing | Vitest + RNTL + Maestro + Zod contracts + AI evals |
| 026 | Environments | dev / preview / staging / prod, separate projects |
| 027 | Secrets | EAS Secrets + Supabase Vault; none in bundle |
| 028 | Releases | Trunk-based + flags; OTA for JS; staged rollout |
| 029 | i18n | i18next + ICU from day one; RTL-ready |
| 030 | Storage | Supabase Storage + CDN, signed URLs |
| 031 | Quality gates | ESLint + Prettier + typecheck + conventional commits in CI |
| 032 | AI context | CLAUDE.md + ADRs are session memory; playbook loop mandatory |
