# Feature 0003 — Core UI primitives (P1-01)

Status: SPEC → BUILD → typecheck + visual screenshot verification (cloud Chromium)
Owner: packages/ui (pure presentational components; no data fetching, no navigation)

## 1. Restatement

The ~5 reusable primitives every Fuel screen is assembled from, per the
design doc's "Native" production screens: `Ring` (circular calorie
progress), `MacroTile` (macro label + grams + linear progress), `ListRow`
(food entry row), `Card` (grouped surface), `NavPill` (floating bottom nav,
presentational). All styling via `@fuel/tokens` — zero raw values (ADR-005).
Theme arrives as a prop for now; ThemeContext lands with P1-02 app wiring.

## 2. UI mapping (design → component)

- Summary screen calorie ring → `Ring` (progress 0..1+, over-target state)
- Macro row (Protein/Carbs/Fat tiles) → `MacroTile` ×3
- Logged-food rows on Summary/Log → `ListRow`
- Grouped white/dark cards everywhere → `Card`
- Bottom floating pill with tabs + big log button → `NavPill`

## 3. Case grid

| Case | Expected |
|------|----------|
| Ring at 0 / 0.5 / 1.0 | Empty track / half arc / full arc |
| Ring > 1.0 (over target) | Caps arc at full; switches to danger color |
| MacroTile at 0 and >100% | Bar empty; bar full + danger tint |
| ListRow long name | Truncates with ellipsis, kcal stays aligned |
| All components, light + dark | Only token colors change; layout identical |
| Typecheck | Green under strict TS with real react-native types |
| Visual | Screenshots reviewed against design doc, light + dark |

## 4. Out of scope

Animations (Reanimated arrives with real screens), press states/haptics,
accessibility labels (added with screen assembly P1-02 — noted so it is
not forgotten), i18n strings (components take text as props only).

## 5. Acceptance

AC1 `pnpm verify` green including packages/ui typecheck.
AC2 Ring math unit-tested (dash offset, clamp, over-target color switch).
AC3 Harness screenshots (light + dark) match the design's Native direction
    on review; screenshots delivered to Harish.
AC4 No raw color/px literals outside tokens import.
