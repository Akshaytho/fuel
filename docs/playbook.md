# The AI Build Playbook — how to get correct features out of Claude, consistently

*For Harish · building Fuel solo with Claude · July 2026*

---

## Why it goes wrong (so the fix makes sense)

Three mechanical reasons, no mystery:

1. **Gaps get filled with guesses.** Any detail your prompt doesn't pin down, the model fills with a plausible default — and "plausible" varies between runs. That's why the same request builds differently each time. The fix is not writing longer prompts; it's forcing the gaps to surface *before* code.
2. **"Looks done" beats "is done" unless verification is part of the task.** If the task is "build X," the natural end state is code that looks like X. If the task is "build X and prove it passes these checks," the end state is different. You must make proof part of the definition of the work.
3. **Every session starts with amnesia.** Without persistent context files, each session re-interprets your conventions, your design system, your past decisions — differently. This is what your SDLC package's `CLAUDE.md` + ADRs exist to solve.

One honest calibration: **nothing gets you literally 100% correct on the first pass — not AI, not senior human engineers.** What you *can* get is a loop where almost all mistakes are found and fixed by Claude itself before you ever see the build, and the few that escape are caught by CI instead of by you tapping through the app. Your time stops being the error detector. That is the real goal, and it's achievable.

---

## The core change: never ask for a feature in one step

Stop saying "build the log sheet." Start running every feature through a four-stage loop. The stages are cheap; skipping them is what's expensive.

### Stage 1 — SPEC FIRST (Claude writes it, you approve it)

Before any code, make Claude produce a short written spec and **wait for your approval**. This is where the "understands differently each time" problem dies — misunderstandings get caught in a 2-minute read instead of a 2-hour rebuild. In Claude Code, use **Plan Mode** for exactly this.

The spec must contain, explicitly:

- **Restatement** — what it thinks you asked for, in its own words
- **UI mapping** — which design screen/element each part implements, referencing your design tokens/components by name
- **Behavior table** — every interaction: what happens on tap, swipe, long-press, back
- **The case grid** — for every input and state: the happy path, the empty state, the error state, the loading state, offline, extreme values (0, negative, huge, emoji, long strings), and permission-denied where relevant
- **Out of scope** — what it will NOT do in this build (kills silent scope drift)
- **Open questions** — anything ambiguous it needs you to decide *now*

> If the spec comes back and something's wrong — that was a bug you just prevented for the cost of reading a paragraph.

### Stage 2 — ACCEPTANCE CRITERIA BECOME TESTS

Turn the spec into a numbered checklist of testable statements ("tapping Save with empty name shows inline error and does not close the sheet"). Then have Claude write the automated tests for those criteria **before or alongside** the code — unit tests for logic, component tests for UI states. Criteria that can't be automated (visual fidelity) become an explicit manual checklist item.

This flips the dynamic: the tests are the spec made executable. Code that misses a case now *fails visibly* instead of passing silently.

### Stage 3 — BUILD SMALL, ONE SLICE AT A TIME

Misses grow super-linearly with scope. "Build the whole logging system" will always miss things; "build the portion-adjustment sheet against this spec" almost never does. One feature = one session = one spec. Bigger things get sliced into a sequence of these. (Feature flags from your SDLC package let unfinished slices ship dark.)

### Stage 4 — VERIFY BEFORE "DONE" (the step that changes everything)

The task is not complete when code is written. Make Claude, in the same session:

1. **Run the tests** and show the output — not "tests should pass," but actual green output
2. **Run the app / render the screen** and check it against the design — screenshot comparison when tooling allows
3. **Walk the case grid** from Stage 1 line by line: demonstrate each case's behavior
4. **Adversarial self-review** — this one is gold: *"Now switch roles. You are a harsh senior reviewer who did not write this code. Find at least 5 real problems — bugs, missed cases from the spec, deviations from the design, loopholes. Check the functionality actually works as stated, not just that it compiles."* A fresh pass in critique mode reliably finds issues the building pass missed. Even better in Claude Code: have a **separate subagent** (fresh context, no attachment to the code) do the review.
5. **Fix what the review found, re-run, then report** — the iterations you used to do by hand now happen inside Claude's loop, before you see anything.

---

## The persistent memory that makes sessions consistent

The loop above fixes each feature. These files fix *consistency across features and months* — they're why your SDLC package insisted on them:

- **`CLAUDE.md`** at the repo root: your conventions, folder structure, design-token rules ("never a raw hex value"), state patterns, how to run tests, links to the ADRs. Claude reads it every session — this is how session #200 behaves like session #2.
- **ADRs** (`/docs/adr/`): the locked decisions. When Claude proposes something that contradicts one, point at the file — instant course correction, no relitigating.
- **Feature specs** (`/docs/features/`): every Stage-1 spec gets saved. Next month's related feature starts by reading it.
- **The design source of truth**: your design doc + tokens file. UI prompts should reference components and tokens *by name*, never "make it look nice."

---

## Copy-paste templates

### Template A — starting any feature (Stage 1)

```
Read CLAUDE.md and /docs/adr/ first. We're building: [feature name].

Design reference: [screen name in the design doc / attached image].
It must use our existing components and tokens by name — no new colors, spacings, or one-off styles.

DO NOT WRITE CODE YET. First produce a spec containing:
1. Your restatement of what this feature does
2. UI mapping: each design element → which of our components implements it
3. Behavior table: every interaction and exactly what it does
4. The case grid: happy path, empty, error, loading, offline, extreme/invalid
   inputs, and interrupted states (app backgrounded mid-action)
5. What is explicitly OUT of scope for this build
6. Open questions — everything ambiguous, as questions for me. Do not pick
   defaults for anything a user would notice; ask.

Wait for my approval before implementing.
```

### Template B — after you approve the spec (Stages 2–3)

```
Spec approved. Now:
1. Convert the spec into numbered acceptance criteria (testable statements).
2. Write the automated tests for those criteria first.
3. Implement, in this order: [slice 1], [slice 2] — stop after each slice
   and show me it working before continuing.
Follow CLAUDE.md conventions. Any deviation from the spec must be flagged
to me, not silently decided.
```

### Template C — the verification gate (Stage 4)

```
Before you call this done:
1. Run all tests and paste the actual output.
2. Walk the case grid from the spec one line at a time and demonstrate each
   behavior (run it, don't reason about it).
3. Compare the built UI against the design reference element by element —
   list every difference, however small.
4. Now switch roles: you are a harsh senior reviewer who didn't write this.
   Find at least 5 real problems — bugs, missed spec cases, design
   deviations, loopholes, broken functionality behind correct-looking UI.
5. Fix everything found, re-run tests, and only then report done —
   including anything you could not verify and why.
```

### Template D — when a build comes back wrong anyway

```
This is wrong: [what's wrong]. Before fixing it:
1. Explain why this happened — what in the spec or your process missed it.
2. Tell me what to add to CLAUDE.md or the spec template so this class of
   mistake can't happen again.
Then fix it and run the full verification gate.
```

Template D is how the system *learns*: every escaped bug becomes a permanent rule. Three months of this and your `CLAUDE.md` encodes exactly the mistakes your project is prone to.

---

## The UI-specific fixes (your "design is right but functionality inside is wrong" problem)

That failure has a specific shape: visual structure is easy to copy, invisible wiring is easy to fake. Countermeasures:

- **Separate the two acceptances.** Every UI feature gets both a *fidelity checklist* (spacings, states, animations match the design) and a *behavior checklist* (every button's action verified by actually triggering it). Ask for them separately — merged, the visual one dominates.
- **Demand state coverage, not screen coverage.** A screen isn't one thing; it's 5–8 states (default, empty, loading, error, success, offline, pro-locked). Make the spec enumerate them and the verification demonstrate each. Storybook (in your SDLC package) makes every state a viewable, checkable artifact.
- **"Wire it or mark it."** A standing rule for `CLAUDE.md`: no dead controls — every interactive element either works or is explicitly marked `// TODO(stub): [ticket]` and flagged in the report. Silent placeholder buttons are the #1 source of "UI right, function wrong."
- **Screenshot-diff when possible.** Have Claude render/screenshot the built screen and compare against the design image side by side, listing differences. Eyes-off pixel claims are worthless; comparisons are cheap.

---

## The one-page version

1. Never "build X." Always: **spec → approve → tests → build small → verify → self-review → done.**
2. Ambiguity is the enemy — force it into **open questions** at spec time, when it costs seconds.
3. Make Claude **run things and show output**, never accept "should work."
4. **Adversarial self-review** (fresh eyes, find 5 problems) catches what the builder-mindset misses.
5. Every escaped bug becomes a **new rule in CLAUDE.md** — the system gets harder to fool every week.
6. Persistent context (`CLAUDE.md`, ADRs, saved specs, tokens) is why next month's Claude agrees with this month's.

The iterations don't disappear — they move inside the machine, where they cost seconds instead of your evenings.
