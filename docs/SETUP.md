# SETUP.md — zero to working, on any machine, in any future

The rule this file exists for: **you should never be stuck.** Whatever broke —
new laptop, dead laptop, lost chat, corrupted folder — one of the sections
below is your path back. Nothing about this project lives only in one place.

## 1. Fresh machine setup (Mac, including Intel Macs)

1. Install Node 22+ → https://nodejs.org (or `nvm install 22`; `.nvmrc` pins it).
2. Install pnpm: `npm install -g pnpm`
3. Install git (comes with Xcode Command Line Tools: `xcode-select --install`).
4. Get the repo (pick one):
   - Already on GitHub → `git clone https://github.com/<you>/fuel.git`
   - From the bundle file → `git clone -b main fuel-repo.bundle fuel`
5. ```bash
   cd fuel
   pnpm install
   pnpm verify        # MUST be green: typecheck + all tests
   ```
6. Run the app on your phone (no Xcode needed):
   ```bash
   pnpm -C apps/mobile start
   ```
   Install "Expo Go" from the App Store / Play Store, scan the QR code.
   iOS/Android store builds are made in the cloud by EAS later (P0 → P4);
   your laptop never compiles native code.

## 2. Putting it on GitHub (do this once — it is your backup)

1. github.com → New repository → name `fuel` → Private → create (empty, no README).
2. ```bash
   cd fuel
   git remote add origin https://github.com/<you>/fuel.git
   git push -u origin main
   ```
3. Done: CI (`.github/workflows/ci.yml`) now runs typecheck + tests on every
   push and pull request automatically. From now on, **GitHub is the source
   of truth** and every push is an off-site backup.

## 3. Starting ANY work session with Claude (the resume ritual)

Paste this into a fresh Claude session (Cowork, Claude Code, anywhere) —
it requires zero chat history:

> This is the Fuel project: https://github.com/<you>/fuel (or attach the
> repo zip). Read `CLAUDE.md`, `docs/TASKS.md`, and `docs/playbook.md`
> first. Then do exactly one thing: the next unchecked task in TASKS.md
> (or: task <ID>). Follow the playbook loop — spec first if it's a feature,
> tests before done, run `pnpm verify` and show real output, adversarial
> self-review, update TASKS.md, commit. Do not start anything else.

That paragraph is the whole handoff. If a session goes bad (confusion,
hallucination, drift): abandon it, discard uncommitted changes
(`git checkout . && git clean -fd`), start a fresh session with the same
paragraph. Nothing is lost — the repo is the memory.

## 4. Disaster recovery

| What broke | What to do |
|-----------|-----------|
| Laptop died / lost | Nothing is lost: `git clone` from GitHub on any machine, section 1. |
| Repo folder corrupted locally | Delete it, re-clone from GitHub. |
| Not on GitHub yet and laptop at risk | The delivered `fuel-repo.bundle` + zip in the Claude conversation are complete copies — download, keep one in cloud storage. |
| Bad code merged, app broken | `git revert <commit>` (never force-push main); CI re-verifies. |
| A dependency upgrade breaks everything | `git checkout pnpm-lock.yaml && pnpm install` restores the last known-good dependency set. Upgrade one package at a time, `pnpm verify` between each. |
| `pnpm verify` red and confusing | That's the system working. Paste the output into a Claude session with the section-3 ritual; fix before any new work. |
| Claude session went off the rails | Kill it. `git status` → discard junk → fresh session. Sessions are disposable by design. |
| Forgot why a decision was made | `docs/adr/` — it's written down, with alternatives and dates. |
| Forgot where anything is | `docs/README.md` is the index of everything. |

## 5. Backup policy (cheap and sufficient)

- **Primary:** GitHub (every push). Private repo.
- **Secondary:** after each milestone, `git bundle create fuel-$(date +%F).bundle main`
  and drop the file in any cloud drive. One command, complete history.
- Supabase (when live) has point-in-time recovery on paid tiers — enabled at
  P0-10. User data backup is the platform's job; code backup is git's.

## 6. Environment facts worth knowing

- `packages/domain` and `packages/tokens` are pure TypeScript — they test and
  typecheck with only Node + pnpm, no simulator, no Xcode, on any machine.
- The Expo app (`apps/mobile`) needs `pnpm install` to fetch React Native —
  first install is large (~hundreds of MB); that's normal.
- Secrets NEVER go in this repo (ADR-027). `.env*` is gitignored; real keys
  live in EAS Secrets / Supabase Vault when those are set up (P0-10+).
