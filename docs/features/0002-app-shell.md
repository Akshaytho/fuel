# Feature 0002 — App shell boots on device (P0-08)

Status: SPEC → BUILT → machine-verified (bundle exports) → awaiting on-phone check
Owner: apps/mobile

## 1. Restatement

Make the Expo app actually bootable: a phone running Expo Go scans the QR
from `pnpm -C apps/mobile start` and sees the Today shell — themed from
`@fuel/tokens`, computing demo targets via `@fuel/domain`. This is
infrastructure glue, not the real Today screen (that's P1-02, spec-first).

## 2. What "boot" requires (the checklist that's easy to miss)

- Entry point: `index.js` calling `registerRootComponent(App)` (robust under
  pnpm; the classic `node_modules/expo/AppEntry.js` main breaks with
  symlinked stores).
- `babel.config.js` with `babel-preset-expo` (Metro won't transform TS/JSX
  without it).
- `metro.config.js` configured for a pnpm monorepo: watch the workspace
  root, resolve from both app and root `node_modules` (otherwise Metro
  can't find `@fuel/tokens` / `@fuel/domain`).
- Light/dark follows the OS (`userInterfaceStyle: automatic` — already set).

## 3. Case grid

| Case | Expected |
|------|----------|
| `npx expo export` (machine check) | Bundles without errors — proves resolver + babel + monorepo wiring |
| Expo Go, light mode | Today title + target card, light theme tokens |
| Expo Go, dark mode | Same layout, dark tokens (no hardcoded colors anywhere) |
| Workspace import | `@fuel/tokens` and `@fuel/domain` resolve from packages/, not copies |
| Cold reload (shake → reload) | Boots clean, no red screen |

## 4. Out of scope

Real Today screen states/data (P1-02); navigation (P1 via Expo Router);
fonts beyond system; splash/icon assets (later polish task).

## 5. Acceptance

AC1 `npx expo export --platform ios` completes with exit 0 in CI-like env.
AC2 Harish confirms: renders on his phone in Expo Go, light and dark.
AC3 No raw color/px values in App.tsx beyond token references.
