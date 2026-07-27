# Fuel

Effortless, honest nutrition tracking. iOS + Android (React Native + Expo),
global from day one. Solo-built with Claude as the engineering partner.

## How this repo thinks

The project's memory is on disk, not in anyone's head or chat history:

- `CLAUDE.md` — conventions + the mandatory session workflow. Read first.
- `docs/TASKS.md` — the state file. One session = one checkbox.
- `docs/adr/` — 32 locked decisions. Don't relitigate; supersede.
- `docs/features/` — one spec per feature (spec → tests → build → verify).
- `docs/playbook.md` — the full working loop.
- `design/` — the design doc (source of truth; "Native" direction shipped).

**New here or coming back after a gap?** `docs/README.md` is the index of
every project document; `docs/SETUP.md` is zero-to-working setup + disaster
recovery + the exact prompt to start any Claude work session.

## Quick start

```bash
pnpm install
pnpm verify          # typecheck + all tests — must be green
pnpm -C apps/mobile start   # Expo dev server (scan QR with Expo Go)
```

## Pushing to GitHub (P0-07)

Create an empty private repo named `fuel` on github.com, then:

```bash
git remote add origin https://github.com/Akshaytho/fuel.git
git push -u origin main
```

CI (GitHub Actions) runs typecheck + tests on every push and PR.

## Status

Phase 0 foundations: repo, docs system, design tokens (extracted from the
design doc), nutrition domain engine (30 green tests), app shell, CI.
Next: `docs/TASKS.md` → P0-07 onward.
