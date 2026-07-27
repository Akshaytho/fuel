# Feature 0004 — Today screen (P1-02)

Status: SPEC → BUILD (slices) → VERIFY (tests + bundle + screenshots) → review
Owner: apps/mobile/screens/TodayScreen.tsx (+ domain meal bucketing)

## 1. Restatement

The home screen of Fuel, per the design doc's production "Summary/Today"
screen (Native direction): large "Today" title with date, the calorie Ring
card with the three MacroTiles, logged entries grouped into meal sections
(Breakfast/Lunch/Dinner/Snacks), and the NavPill. The screen is PURELY
presentational: it receives a view-model and callbacks; no fetching, no
storage (data layer is P1-05). States are explicit and exhaustive.

## 2. UI mapping (design → build)

- Large title + date caption → largeTitle token + secondaryLabel
- Summary card: `Ring` (remaining kcal center) + 3 × `MacroTile` in `Card`
- Meal sections → `Card header="BREAKFAST" …` with `ListRow` per entry
- Bottom `NavPill` (Today active) — onLog callback REQUIRED (no dead controls)
- Offline: thin banner under title: "Offline — will sync" (secondary style)
- Over-target: Ring/tiles switch to danger via existing component behavior

## 3. View-model (the screen's contract)

```
type TodayVM =
  | { kind: 'loading' }
  | { kind: 'ready'; dateLabel: string; offline: boolean;
      targets: Targets; summary: DaySummary;
      meals: { id: Meal; title: string; entries: EntryVM[] }[] }
EntryVM = { id: string; title: string; subtitle: string; trailing: string }
Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
```
Meal bucketing is domain logic: `mealForHour(h)` — <11 breakfast,
11–15 lunch, 15–17 snack, 17–21 dinner, else snack. Unit-tested.

## 4. Case grid

| Case | Expected |
|------|----------|
| Loading | Skeleton blocks (bg-toned), no text flash, no layout jump vs ready |
| Empty day (ready, 0 entries) | Ring at 0 with full targets; teaching card: message + "Log your first meal" CTA wired to onLog; NO empty meal sections |
| Normal day | Sections only for meals that have entries, in day order |
| Over-target day | Ring full + danger; remaining shows 0 with "over by N" caption |
| Offline | Banner visible; everything else unchanged |
| Dark mode | All states identical layout, dark tokens |
| mealForHour boundaries | 10:59→breakfast, 11→lunch, 15→snack, 17→dinner, 21→snack, 3→snack |
| Long names / many entries | Rows truncate; screen scrolls; NavPill stays at bottom |

## 5. Out of scope (explicit)

Data fetching/store (P1-05), navigation between tabs (P1 router task),
animations/Reanimated polish (post-P1-02 task), pull-to-refresh, editing
or deleting entries (P1-04 portion sheet), real i18n (P0-12 — strings
centralized in strings.ts meanwhile).

## 6. Acceptance criteria

AC1 mealForHour unit tests pass incl. all boundary hours.
AC2 `pnpm verify` green; `expo export` bundles clean.
AC3 Harness screenshots: loading/empty/normal/over × light+dark reviewed
    against design; delivered to Harish.
AC4 Zero raw style values; all user-visible strings from strings.ts.
AC5 Every interactive element wired (onLog) or explicitly absent.
