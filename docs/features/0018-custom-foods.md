# 0018 — Custom foods: the user's own kitchen

## Restatement

A person can create their own food — name plus per-100 g kcal, protein,
carbs, fat, and optional fibre — from the search screen, and immediately log
a portion of it. The food is theirs alone, permanently searchable, and flows
through every existing engine (go-tos, repeat meals, Easy Day, fibre
honesty) with no new downstream code.

Why this is repair item #1 (rival attack report, Aug 2026): the app cites
Cordeiro's finding that home-cooked food is the hardest to log (4.6/10 vs
6.4 for packaged) and then shipped no way to log a home recipe at all. Every
competitor has this. It also unblocks the India wedge: home kitchens are
most of what India eats.

## UI mapping

- Search screen: when the query is 2+ chars, a card "Add "<query>" yourself"
  appears above the Describe teaser (working feature above coming-soon).
- Create sheet: name (pre-filled from the query), then per-100 g fields —
  kcal, protein, carbs, fat, fibre (optional). Save CTA: "Save & pick
  portion". On success the standard Portion sheet opens for the new food.
- On failure (offline, server): inline error, all typed values retained.

## Behavior

| Situation | Behavior |
|---|---|
| Fibre left empty | Stored as NULL — unknown, never zero (spec 0015) |
| kcal disagrees with 4/4/9 macros by ≥ max(30, 25%) | A note names the implied kcal; never blocks — their word wins |
| Empty/overlong name, negative/NaN/impossible numbers | CTA disabled (domain `checkCustomFood`) |
| Decimal comma ("88,5") | Accepted (`parseFoodNumber`) |
| Signed out | Create requires a session; search falls back to catalog-only (anon) |
| Search ranking | Own foods outrank catalog on everything except an exact-name match (migration 0008) |
| RLS | Own rows: select/insert/update/delete self only; catalog: read-only; `(source='user') = (owner_id is not null)` enforced by check |
| Sync/restore | It is a foods row — restores with everything else; log entries denormalize macros as before |

## Case grid (tested)

- checkCustomFood: name empty/max/max+1; kcal 884 ok / 901 blocked; each
  macro negative, NaN, >100 blocked; fibre null vs 0 vs negative; Atwater
  note both directions, silent on rounding, suppressed while blocked.
- parseFoodNumber: empty→null, comma decimal, garbage→NaN, plain numbers.
- Search RLS/ranking and insert policy: server-side, verified after the
  migration is applied (scripts/check-search.py extension — see open items).

## Out of scope (next tasks, in order)

- F-02 Recipes: multi-ingredient foods composed from other foods.
- Per-serving entry ("1 katori", "2 rotis") — household measures; currently
  per-100 g only, which is the wrong unit for India and the US. Tracked as
  part of database/portions repair (attack report item 3).
- Edit/delete of a custom food from the UI (RLS already allows it).
- Barcode/photo creation (Phase 2 camera).

## Open questions for the phone run

- Keyboard overlap: 6 inputs in a bottom sheet on small phones — does the
  fibre row stay reachable with the keyboard up?
- Should the create card also appear when search returns 0 results with a
  <2-char query? Currently hidden below 2 chars to match search itself.
