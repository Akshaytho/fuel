# Fuel — AI context file (read this first, every session)

Fuel is a global nutrition-tracking app (iOS + Android, React Native + Expo).
Solo founder (Harish) + Claude. Production-grade quality bar. This file is the
session-independent memory: follow it exactly; when in doubt, it wins over
your instincts.

## Trust debt (read this before claiming ANYTHING works)

Harish has been told "it works" and then watched it fail on his phone. That
is betrayal, and it happened. The rule that follows: NEVER report a thing as
working from reasoning alone. Every claim of "done" must cite the actual
command run and its actual output — unit tests, the tap-only journey, the
device-shape harness, a live DB query, or his on-phone run. If something was
not executed, say "built but not yet verified" in those words. When an error
is found, fix it in the same session — never log-and-move-on for anything a
user would hit. Where installed Claude skills genuinely apply (design
critique, accessibility review, UX copy, dataviz for charts), USE them
rather than winging it.

## The workflow (non-negotiable)

Every work session follows the loop in `docs/playbook.md`:

0. PHASE GATE (Harish's standing rule): a task/phase is done only when its
   UI matches the extracted design screen AND every function in it works.
   Never advance to the next item while known half-work exists — finish it
   or get Harish's explicit OK to defer (logged in TASKS.md).
0a. HUMAN-TAP TESTING (Harish's standing rule): every screen test navigates
   the way a real user does — tapping visible controls and typing into
   fields, in order, from app open. NEVER navigate by URL, injected state,
   storage seeding, or calling handlers directly. `page.reload()` is allowed
   ONLY to simulate killing and relaunching the app, never as a shortcut to
   reach a screen. A flow you can't reach by tapping is a broken flow.
0b. MOTION IS PART OF DONE (Harish's standing rule): the app must FEEL
   alive, not like static pages. App open plays the Fuel brand animation;
   rings/progress animate to their value; stage transitions animate;
   pressables give press feedback. A screen that snaps into place fully
   formed is half-work under rule 0.
0d. BOTH THEMES, ALWAYS: the app follows the system theme, so dark mode
   ships to users automatically — it is never "the light one plus later".
   Every screen is rendered AND contrast-audited in both themes
   (tools/visual-harness/dark-mode-check.mjs). Color choices are locked at
   the TOKEN level by packages/tokens/test/contrast.test.ts (WCAG AA: 4.5:1
   normal text, 3:1 large). iOS system colors do NOT all pass — use the AA
   variants in the palette, never raw #0A84FF/#8E8E93/#FF375F for text.
0c. TWO-YEAR LIFE REVIEW (Harish's standing rule): every feature is reviewed
   from a real human's perspective across a simulated ≥2-year lifespan
   before it is called done. That means: time conditions (DST both ways,
   leap day, year rollover, ISO week 53, month ends, midnight-local logs),
   human patterns (gaps, relapses, weekends-only, night shifts, travel
   across timezones, 2-year absences), body extremes (clamped small users,
   150 kg+ users, goal switches mid-journey), math degeneracies (flat
   series, negative zero, single points, plateaus), and DATA GROWTH (2
   years of daily logging — thousands of rows — with perf assertions, and
   charts that window rather than render everything). The lifespan suites
   in packages/*/test/lifespan.test.ts are the executable form of this
   rule; new features must extend them.
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

## Harm avoidance (added after docs/research/0002)

Fuel is a calorie tracker, and the evidence that calorie trackers worsen
disordered eating is strong enough to be a design constraint rather than a
footnote. Eikey et al. (BJPsych Open) found the harm came from ORDINARY,
well-intentioned features: red/green over-budget colouring triggering "guilt,
embarrassment and shame"; streaks becoming a contest to eat progressively
less; diary-completion warnings motivating continued weight loss regardless of
intent. Standing rules, all of them already enforced by tests:

- **Nothing turns red for a rounding error.** Colour follows
  `isMeaningfullyOver` / `RING_OVER_TOLERANCE` (5%); wording stays literal.
- **No good/bad food labels, no warning popups, no leaderboards.**
- **Never monetise anxiety.** Cal AI sells a $0.99 "Streak Restore". Fuel will
  not sell, gift or restore rest days, now or later.
- **Never claim someone logged a day they did not.** Rest days are shown as
  rest days; half-logged days are shown as half-logged.
- **Keep the floors.** Sex-specific kcal floors and the deficit cap are safety
  features, not tunables.
- **Express uncertainty when we have it.** The NIH found photo-logging apps
  underestimate by 250–345 kcal per meal. When Fuel ships photo/describe
  logging it shows a RANGE, never a fake precise number.

## Competitive position (docs/research/0002)

Fuel already has the thing only MacroFactor has — adaptive TDEE from weight
trend plus intake — and the thing almost nobody has: an offline-first,
contrast-audited, adherence-neutral build. The known remaining gaps are saved
meals/recipes, fibre, food-data provenance, and everything blocked on a device
build (health integrations, widgets, reminders). Design for weeks 4–12: the
category dies at 3–5 weeks and the median quit is week 10.

## When you (Claude) make a mistake

Diagnose why, then add a rule here or to the feature spec so the mistake
class can't recur. This file is allowed to grow; it is the project's immune
system.
