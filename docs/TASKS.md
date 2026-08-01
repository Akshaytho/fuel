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
- [x] P1-07 Profile + export + delete (spec 0008): Profile screen per design (+ compliance Delete row); CSV export w/ profile lines; delete-account Edge Function DEPLOYED (JWT-verified, 401s proven) erasing rows+auth user; 15-step lifecycle journey ALL PASS; erasure admin-verified vs control user. Phase 1 code COMPLETE — phase exit = Harish's on-phone run (P0-08)

## Backlog / discovered work

- [x] B-11 DONE (session 4b) — reviewed and accepted. Versions consistent (expo ~54.0.36,
      RN 0.81.5, react 19.1.0, expo-sqlite ~16.0.10, rn-svg 15.12.1 exact); @fuel/ui declares
      react/react-native/react-native-svg as PEER deps (no second physical copy), and metro's
      resolveRequest forces all three to resolve from the app — a guard, not just a pin.
      Both bundles export clean under the new SDK: iOS 740 modules / 2.15 MB hbc, Android
      2.16 MB hbc. Added an explicit `platforms: ["ios","android"]` to app.json — without it
      an export run from the repo root silently defaulted to web-only.
- [x] B-12 DONE (session 4): migration 0004 adds log_entries.meal; LocalEntry carries it;
      logIt persists it; the entry row now reads "Dinner · 100 g · 51 kcal". Journey taps the
      meal chip and asserts the choice survives the log.
- [x] B-13 DONE (session 4): honest stub treatment — Trends/Report render dimmed (0.4) so
      they never read as live destinations (the P0-C lesson), and tapping answers "Arrives in
      Phase 2, once you have a few weeks of logs to chart." Real screens are Phase 2 scope.
- [x] B-14 DONE (session 4): auth.refresh() (single-flight, so a burst of 401s can't race
      and invalidate each other's rotated token) + authedFetch() which retries once on
      401/403. ALL authenticated calls now go through it: log push, water push, profile
      upsert, delete-account.
- [x] B-15 FIXED (session 2): sign-in→sign-up fallback kept, but a sign-up rejection of
      "already registered" now surfaces as "Wrong password for this email" (the only way that
      branch is reached). Regex verified against live GoTrue 422 user_already_exists.
- [x] B-16 DONE (session 4): streak is now domain computeStreak() over real logged days
      (current/longest/isLongest/loggedToday, 10 tests incl. DST + gap-breaking). Water is a
      real feature: water_entries table (client_id idempotent, RLS), WaterStore (8 tests),
      tap-to-add 250 ml, long-press undo, syncs and survives relaunch.
- [x] B-17 DONE (session 4): domain dayNumber(startDay, today) from the stored createdAt;
      header reads "· Day N" always. Day arithmetic is DST-proof (UTC-parts, unit-tested).
- [x] B-18 DONE (session 4): initial derived from the signed-in account; journey asserts a
      journey-* account shows "J", not "A". Avatar also gained press feedback.
- [x] B-19 DONE (session 4): four distinct states (synced / pending / offline / failed).
      "No connection" is claimed only when the platform says navigator.onLine === false;
      a failed push now surfaces "Sync failed — tap to retry" as a real, tappable retry.
- [x] B-20 DONE (session 4): 250 ms debounce + stale-response guard + a "Searching…"
      indicator. Ranking moved INTO Postgres (migration 0005: pg_trgm index + search_foods()
      RPC ranking exact > prefix > word-start > trigram similarity > shorter name). Client-side
      re-ranking was rejected as unscalable — at a million foods the right rows aren't in the
      alphabetical first page. Live-verified: "banana" → "Bananas, raw" first.
- [x] B-21 AppRoot recomputes remaining/progress inline instead of calling summarizeDay(),
      bypassing day.ts's zero-guard + round1. The tested domain path is not the shipped path.
      DONE session 4: domain gained summarizeConsumed(); AppRoot's vm now calls it directly.
- [x] B-25 DONE (session 4): countable anchors (steps + sessions) instead of adjectives,
      plus an explicit "torn between two? pick the lower one" nudge explaining that a too-high
      number is what quietly stalls progress. Also fixed a dishonest search caption that
      claimed results were "ranked by what you actually eat" (no personalization exists).
- [x] B-22 DONE (session 4): OWASP mitigation — any field starting = + - @ tab or CR is
      prefixed with an apostrophe so the cell stays text. Meal column added to the export.
- [x] B-23 DONE (session 4): tools/visual-harness/interact-device-shape.mjs — reshapes the
      browser to the DEVICE shape before boot (Web Crypto deleted = Hermes; Asia/Kolkata at
      00:30 local = the previous UTC day) and walks the real app by taps. Asserts: fallback id
      is a real RFC 4122 v4, Postgres ACCEPTS it (sync truly completes), entries+water file
      under the local day, and — the step that reproduces the actual user-visible failure —
      the log SURVIVES the UTC rollover (clock advanced past midnight UTC, then relaunch).
      NEGATIVE-CONTROLLED: both P0s were reintroduced and every relevant step failed; the
      first draft of the "still visible" assertion passed under the bug and was replaced.
      Wired as `pnpm e2e` (journey + device-shape).
- [x] B-24 DONE (session 3, cloud): delete-account v2 redeployed via Management API with the
      CORS-fixed source; live-verified — OPTIONS preflight 204 with Access-Control-Allow-*
      headers, unauthenticated POST still 401. Laptop harness can now drop the functions/v1
      curl bridge.
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
- 2026-07-27 · session 1p (cloud) · P1-07 done: edge function via Management API deploy; full GDPR arc in one driven journey (signup→log→export→delete→Welcome); server-side erasure verified with control account.
- 2026-07-28 · session 2 (Harish's Mac) · P0-08 prep + full-surface audit. Repo cloned, node 22 + pnpm 10.28.0, pnpm verify green. Expo Go forced SDK 53→54 (B-11). Audit found 14 issues; TWO P0s fixed under TDD (red proven first):
  P0-A client_id was not a valid uuid on device — RN/Hermes has no Web Crypto (expo 54 installs TextDecoder/URL/structuredClone, not crypto), so defaultId's fallback ran and emitted `<hextime>-<hex>-<hex>`; log_entries.client_id is a Postgres `uuid` col, which 400s with 22P02, and sync() swallowed it in `catch { break }`. Net effect: NOTHING has ever synced from a real device; the "offline" badge stayed on while fully online. Invisible to all tests because the harness runs in Chromium (has crypto.randomUUID). Fixed: RFC 4122 v4 fallback; verified live — the generated id now parses (HTTP 200, was 400).
  P0-B day bucket used toISOString() (UTC) while the header rendered the LOCAL date; in IST everything logged 00:00–05:30 filed under yesterday and vanished from Today at 05:30. Fixed: new domain `localDayISO()`; domain suite now pins TZ=Asia/Kolkata (vitest.config.ts) because ubuntu-latest CI is UTC and structurally could not catch it (B-23).
  P0-C (found BY the on-phone run, which is the point of the gate) Welcome screen made sign-in impossible: "Use email instead" — the only working auth path until B-09 — was rendered in secondaryLabel grey while "Restore purchase" (a coming-soon stub) got tint+600 weight, and the only tinted glyph in the email link was the "·" separator. Every affordance that looked tappable answered "Coming soon". Fixed: tint/weight moved to the email link, Restore de-emphasized, separator neutral, hitSlop added. No design-doc divergence — the tint was on the wrong element.
  Tests 58 → 66 green. Remaining 12 findings logged as B-12..B-22. Phase gate still open: awaiting Harish's on-phone run (P0-08).
- 2026-07-28 · session 2b (Harish's Mac) · SDK-54 aftermath fixed live during phone attempts: duplicate React (ui pinned 19.0.0 vs app 19.1.0 → "Invalid hook call" on device) and duplicate react-native-svg (caret drift 15.15.5 vs 15.12.1 → "two views named RNSVGCircle"); exact pins + metro singleton resolveRequest for react/react-native/react-native-svg (guard, not just pins). B-15 fixed + verified vs live GoTrue. Welcome auth-link inversion fixed (P0-C). Harness PORTED to laptop (was cloud-only: hardcoded /home/claude path, /opt/pw-browsers, curl bridge) — now HEADED=1 runs the real AppRoot in visible Chrome, phone-frame, human-paced typing. Full 15-step lifecycle run headed on Mac: found delete-account edge fn lacks CORS (browser preflight dies; sandbox bridge had masked it) → source fixed, B-24 redeploy pending, harness bridges only functions/v1 meanwhile. Re-run: 15/15 FULLY PASSED (screenshots tools/visual-harness/out/j1..j7). Both journey accounts verified erased server-side (sign-in 400). Phone gate (P0-08) STILL OPEN — Expo Go run on the physical device remains the exit condition.
- 2026-07-28 · session 3 (cloud) · Pulled session-2/2b work from Harish's Mac; understood all findings (3 P0s incl. Hermes-no-WebCrypto sync-killer + UTC day bucket + Welcome tint inversion; SDK54 aftermath; harness ported/headed). Verified 66 tests green here post-SDK54. Closed B-24 (edge fn v2 live w/ CORS, preflight 204 verified). Next: audit fixes B-12..B-23 in order.
- 2026-07-28 · session 4 (cloud) · Harish's three demands actioned. (1) DEEP RESEARCH on target math → docs/research/0001-target-math.md (every constant now cites evidence): Mifflin-St Jeor + standard multipliers KEPT (AND-recommended); FIXED: sex-specific floors 1200F/1500M (was 1200 both), deficit capped at 1000 kcal/day + surplus at 500 (percentages must not scale infinitely), protein now goal-based (lose 2.0 / maintain 1.6 / gain 1.8 g/kg) of ADJUSTED reference weight above BMI 25 (150kg user: 196.5g, was an absurd 270g) with 35% AMDR cap → macros now always sum to the kcal target (new invariant tests; 54 domain tests green). Water clamped [1.5, 4.0]L. Journey profile's plan changed 123g→136g protein. (2) MOTION (new rule 0b): BootSplash brand moment on app open (spring mark + wordmark, min 1400ms hold), FadeSlideIn stage transitions, TripleRing/Ring arcs SWEEP to value (RAF tween — reliable on Hermes AND web), CTA press feedback. Journey asserts splash on open AND on relaunch, and proves arcs animate (two-sample dasharray diff). (3) HUMAN-TAP testing law recorded as rule 0a; journey navigates by taps/typing only — page.reload() annotated as the one allowed relaunch simulation. B-21 CLOSED (summarizeConsumed is the shipped path). BONUS P0-class find: pnpm typecheck NEVER covered apps/mobile — a ReferenceError (consumed) shipped past verify and only the harness caught it; app typecheck added to the verify gate (6 latent type errors fixed). 17/17 journey steps green headless; screenshots j0-boot..j7.
- 2026-07-29 · session 4b (cloud) · Audit backlog cleared: B-12/13/14/16/17/18/19/20/22/23/25 all closed (B-11/B-15/B-21/B-24 were already done). Two migrations applied live (0004 water_entries + log_entries.meal, 0005 pg_trgm + search_foods RPC), both verified against the real DB. Journey grew 15 → 21 tap-only steps; new device-shape harness (8 steps) reproduces the Hermes/no-WebCrypto and IST-midnight shapes and was NEGATIVE-CONTROLLED by reintroducing both P0s — which also caught that my first "entry still visible" assertion passed under the bug (a single-instant check can't see it; the entry vanishes only when UTC rolls over hours later, so the step now advances the clock and relaunches). Journey also caught a live copy bug: day one read "1 days · your longest". `pnpm e2e` now runs both harnesses. Phase gate P0-08 (Harish's on-phone Expo Go run) remains the one open exit condition.
- 2026-08-01 · session 5 (cloud) · TRUST rule added to CLAUDE.md (never claim "works" without citing the executed check; fix errors in-session; use installed Claude skills where they apply). Phase 2 opened with spec 0009 Trends, built skill-first: dataviz skill loaded BEFORE chart code; its validator run on our tokens PROVED they fail as a categorical set (orange↔green protan ΔE 5.1), so every chart is single-hue by construction (weight=blue+gray de-emphasis dots, energy=green bars+gray target line, protein weeks=monotonic opacity ramp — monotonicity unit-tested). Domain: trends.ts (smoothWeights, weeklySlopeKgPerWeek honest-null under 7-day span, dailyTotals, proteinDaysByWeek ISO weeks, loggedPercent) — 13 new tests. Store: WeighInStore (one measurement/day, replace semantics, re-sync after correction) — 7 tests. UI: chartMath + TrendLineChart/DayBarChart/WeekBarChart per dataviz mark specs (2px lines, ringed dots, ≤24px bars w/ 4px rounded data-end, hairline grids, text in text tokens), all animated (rule 0b). TrendsScreen w/ honest empty states; weight sheet; Trends tab LIVE (Report stays dimmed-soon). Migration none needed (weigh_ins existed since v1, unused). GDPR: export now includes water+weigh-ins; delete-account v3 deployed adding water_entries to the explicit erasure list (was cascade-only — found by auditing, fixed same session). LIVE server proof: weigh-in push 201, same-day correction upserts to ONE row (68.0), delete 200, sign-in-after-delete 400. Journey 21→28 tap-only steps — and it CAUGHT a crash I shipped (trendsVM read stores before init; boot died with "LogStore.init() not called") — fixed at the source with the same stage guard the Today vm has. Verify green (98 unit tests), journey 28/28, device-shape 8/8. Screenshots j8/j8b/j9 vs design 4f.
- 2026-08-01 · session 5b (cloud) · Rule 0c adopted (TWO-YEAR LIFE REVIEW) and made EXECUTABLE: packages/domain/test/lifespan.test.ts (22 tests) + packages/store/test/lifespan.test.ts (4 sims). Simulated span 2026-08-01→2028-07-30 (leap day 2028-02-29, DST both ways, two New Years, ISO week 53). Personas: Meera (730-day streak, 100% logged, 2,190-entry analytics <250ms), Raj (weekdays-only + 3-week relapse: streak breaks honestly, longest survives, loggedPercent exact), Chloe (2yr weigh-ins: smoothing tames noise 3×, slope −0.4 in loss phase, plateau ≈0), Bob (152→97kg: targets re-obey every invariant monthly; lose→maintain switch RAISES kcal), traveler (west-flight relived day sums into one bucket; 25-hour fall-back day = one bucket), 2-year-absence user (Day 730, streak 0, no fake data), binge day (progress >1, honest negatives). FOUND & FIXED (3): (1) "-0 kg/week" — Math.round lets negative zero escape weeklySlopeKgPerWeek/smoothWeights for barely-moving users; probe-confirmed, normalized at source, regression test locked. (2) flaky-network sync starvation — stop-at-first-failure made 15%-flaky network drain only ~7 entries per app open; 641 of ~2,190 entries were STILL pending after 50 opens in sim. Fix: one immediate in-pass retry per entry (safe — pushes idempotent) in all three stores; sim now drains to 0 with exactly-once accounting (push count == add count, zero duplicates). Legacy tests updated to the explicit new contract (1 blip absorbed / 2+ failures = down → pending). (3) weight chart unbounded growth — 2 years = 730 raw dots (1,460 SVG nodes); windowed to last 90 days in trendsVM (slope/delta over the window = the user's CURRENT story). All green after: 101 domain + 34 store + 12 ui tests, journey 28/28, device-shape 8/8.
