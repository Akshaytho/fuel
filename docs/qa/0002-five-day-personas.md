# QA 0002 — Five days, five mindsets

Harness: `tools/visual-harness/five-days.mjs`. One account lives five
consecutive calendar days (Playwright clock advances; each morning is a real
relaunch). Each day a different human shows up. Steps that fail are bugs;
steps that pass but *feel* wrong are recorded as FRICTION.

| Day | Person | Mindset |
|-----|--------|---------|
| 1 | Aarti | anxious beginner — logs immediately, checks constantly |
| 2 | Dev | busy professional — forgets all day, batch-logs at 23:00 |
| 3 | Sam | weekend blowout — eats far over, dreads being judged |
| 4 | Nina | sick day — never opens the app |
| 5 | Ravi | back on it — protein day, weighs in, wants the win |

## Round 1 — what the personas exposed

**P0 (crash-class).** Two of the ten screenshots came back COMPLETELY BLANK.
Cause: `FadeSlideIn` wraps an entire screen and RN Web's `Animated.timing`
drives itself from `Date.now()`. With the clock frozen the tween never
advanced, so the wrapper sat at `opacity: 0` forever. This is not a
test-only condition — an NTP correction, a timezone change, a manual clock
edit or a stalled JS thread all produce the same wedge on a real phone, and
the result is an app that opens to nothing with no way back.

**Voice failures.**
1. Sam ate 2,067 kcal over target and the strip under the rings said
   *"Nice — 0 g protein to go."* Cheerful, technically true, tone-deaf.
2. Ravi's day landed on target and the app said nothing at all. Design 6a
   ("Target hit — the moment that brings them back") existed but was unbuilt.
3. Ravi came back after one missed day and got the copy a brand-new user
   gets — *"Log your first meal"*, *"Day 1 of your streak starts now"* — his
   3-day run erased and unmentioned. The app forgot him.
4. No screen answered "how many days did I log this week". The Report needs a
   complete week and said "almost ready" for five days running.

## Round 2 — the fixes, and the proof

| Finding | Fix | Proof |
|---|---|---|
| Blank screen | `useSettled` failsafe forces the final state on every animation; `useReducedMotion` honors OS Reduce Motion | `motion-resilience-check.mjs` — 3 scenarios, negative-controlled |
| "Nice" on a blowout | `dayNote()` in `packages/domain/src/narrative.ts` reads the whole day + the week; `CoachStrip` gained a neutral `perspective` surface | five-days D3 asserts the text AND the background color |
| No celebration | `celebrationFor()` + `CelebrationOverlay` (design 6a), once per day, auto-dismiss 3 s | five-days D5 captures it and asserts it does not replay after relaunch |
| Streak amnesia | `comebackNote()` + `ComebackCard`; returning-user empty copy | five-days D5 asserts "Welcome back" and the remembered best run |
| No week answer | `weekAtAGlance()` + `WeekStrip` on Today | five-days D5 asserts "N of M days logged this week" |

Every FRICTION note from round 1 is now a hard assertion. Round 2 result:
all steps PASS, **FRICTION FOUND: 0**.

## Things found while fixing, not by the personas

- iOS system green `#34C759` is **2.22:1** on a white card — under the WCAG
  1.4.11 3:1 floor for non-text content. The week dots carry information that
  appears nowhere else, so they use a new `successGraphic` token. The rings
  keep system green because every ring is duplicated verbatim by the number
  printed beside it (1.4.11 exempts redundant presentation).
- The celebration originally fired the moment calories entered the on-target
  band — which at 14:00, with dinner still ahead, would have told a person to
  "coast from here" on a day that was not over. Calories-on-target now only
  celebrates from 20:00 local; a protein win celebrates at any hour, because
  hitting protein cannot be un-hit.
