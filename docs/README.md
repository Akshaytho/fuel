# docs/ — the project's memory. Start here.

Every document produced for Fuel lives in this repo, so nothing depends on
any chat history, laptop, or person's memory. This page is the index: what
each file is, when to read it, and how to open it.

## How to open these files

- **`.md` files** — render directly on GitHub (just click them), or open in
  any text editor / VS Code.
- **`.html` files** — download and double-click to open in any browser
  (phone or computer). GitHub shows HTML as source code, not rendered — to
  view rendered, open the downloaded file locally, or use
  `https://htmlpreview.github.io/?<raw-github-url>` once the repo is pushed.
- **`design/Fuel App.dc.html`** — the original design document; open locally
  in a browser. It needs `support.js` and `ios-frame.jsx` sitting next to it
  (they are — never separate these three files).

## The map — read in this order when new (or returning after a gap)

| File | What it is | Read when |
|------|-----------|-----------|
| `../CLAUDE.md` | Conventions + the mandatory session workflow | **Every session, first** |
| `TASKS.md` | The state file — what's done, what's next | **Every session, second** |
| `SETUP.md` | Zero-to-working setup + disaster recovery + how to start any Claude session | Setting up a machine; anything breaks; starting a session |
| `playbook.md` | The full working loop (spec → tests → build → verify) with copy-paste prompt templates | Before building any feature |
| `adr/README.md` | Ledger of all 32 locked decisions | Before proposing any tech change |
| `adr/NNNN-*.md` | Full rationale for the highest-stakes decisions | When questioning that decision |
| `features/NNNN-*.md` | One spec per feature (case grid, acceptance criteria) | Before touching that feature |
| `product/Fuel-implementation-blueprint.html` | The original implementation strategy (stack, architecture, economics, roadmap) | Big-picture orientation |
| `product/Fuel-SDLC-decision-lock.html` | The full pre-implementation SDLC package: requirements/NFRs, all ADR rationale, data model, security & global compliance (GDPR/CCPA/DPDP), testing, observability, cost model, 4-year risk register, phase plan | The master reference — when planning any phase or revisiting any decision |
| `../design/Fuel App.dc.html` | The design source of truth (~30 screens; "Native" direction is the production one) | Before building any UI |

## Rules that keep this working

1. Docs are updated **in the same commit** as the change they describe —
   an out-of-date doc is worse than no doc.
2. Decisions change only by superseding an ADR, never by silent drift.
3. Every feature starts as a spec in `features/` and every session updates
   `TASKS.md`. If it isn't written here, it didn't happen.
