import { describe, it, expect } from 'vitest';
import { goTosForMeal, hourDistance, medianHour } from '../src/gotos';
import { weekAtAGlance, comebackNote, WEEKLY_FLOOR_DAYS, COMEBACK_QUIET_GAP_DAYS } from '../src/narrative';
import { computeStreak } from '../src/streak';
import type { LoggedItem } from '../src/gotos';

/** Spec 0017 — the three retention mechanics from docs/research/0004. */

const D = (n: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};
const at = (day: string, h: number, m = 0) =>
  `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const item = (name: string, day: string, h: number, meal: LoggedItem['meal'] = 'breakfast'): LoggedItem => ({
  food_id: null, food_name: name, grams: 100, kcal: 100,
  protein_g: 5, carbs_g: 10, fat_g: 2, meal, day, logged_at: at(day, h),
});

describe('E-06 · hourly go-tos', () => {
  it('hour distance is circular: 23:00 and 00:00 are an hour apart', () => {
    expect(hourDistance(23, 0)).toBe(1);
    expect(hourDistance(7, 10)).toBe(3);
    expect(hourDistance(0, 12)).toBe(12);
  });

  it('median hour shrugs off one odd 3 pm breakfast', () => {
    expect(medianHour([at(D(0), 7), at(D(1), 7), at(D(2), 15)])).toBe(7);
    expect(medianHour([])).toBeNull();
  });

  it('the 7 am food leads at 7, the 10:30 food leads at 10 — same meal slot', () => {
    const entries = [0, 1, 2].flatMap((i) => [
      item('Eggs', D(i), 7), item('Oats', D(i), 10),
    ]);
    const at7 = goTosForMeal(entries, 'breakfast', D(3), 4, 60, 7);
    const at10 = goTosForMeal(entries, 'breakfast', D(3), 4, 60, 10);
    expect(at7[0]!.food_name).toBe('Eggs');
    expect(at10[0]!.food_name).toBe('Oats');
  });

  it('BANDING: a 20-time staple an hour off beats a one-off logged exactly now', () => {
    const entries = [
      ...Array.from({ length: 20 }, (_, i) => item('Oats', D(i), 8)),
      item('Cake', D(21), 7),
    ];
    const now7 = goTosForMeal(entries, 'breakfast', D(22), 4, 60, 7);
    expect(now7[0]!.food_name).toBe('Oats');     // band 0 for both (1h ≤ 1h), count wins
  });

  it('a 23:30 habit is close at 00:15 (circular)', () => {
    const entries = [
      ...[0, 1, 2].map((i) => item('Toast', D(i), 23, 'snack')),
      ...[0, 1, 2].map((i) => item('Milk', D(i), 12, 'snack')),
    ];
    const midnight = goTosForMeal(entries, 'snack', D(3), 4, 60, 0);
    expect(midnight[0]!.food_name).toBe('Toast');
  });

  it('without an hour, ranking is exactly the old contract', () => {
    const entries = [0, 1, 2].flatMap((i) => [item('Eggs', D(i), 7), item('Oats', D(i), 10)]);
    const plain = goTosForMeal(entries, 'breakfast', D(3));
    expect(plain).toHaveLength(2);               // both surface, count-tied, recency breaks
  });

  it("a food's dinner hour does not drag its breakfast ranking around", () => {
    const entries = [
      ...[0, 1, 2].map((i) => item('Rice', D(i), 8, 'breakfast')),
      ...[0, 1, 2, 3, 4].map((i) => item('Rice', D(i), 20, 'dinner')),
      ...[0, 1, 2].map((i) => item('Poha', D(i), 12, 'breakfast')),
    ];
    // at 8 am, Rice's BREAKFAST hour (8) governs, not its dinner-heavy history
    const at8 = goTosForMeal(entries, 'breakfast', D(5), 4, 60, 8);
    expect(at8[0]!.food_name).toBe('Rice');
  });
});

describe('E-05 · the weekly floor', () => {
  const T = 1547;
  const day = (n: number, kcal: number) => ({ day: D(n), kcal });
  // D(4) = 2026-01-05, a Monday
  const MON = 4;

  it('flips at exactly three logged days', () => {
    expect(WEEKLY_FLOOR_DAYS).toBe(3);
    const two = weekAtAGlance([day(MON, 1500), day(MON + 1, 1500)], D(MON + 2), T);
    expect(two.weeklyFloorHit).toBe(false);
    const three = weekAtAGlance([day(MON, 1500), day(MON + 1, 1500), day(MON + 2, 1500)], D(MON + 2), T);
    expect(three.weeklyFloorHit).toBe(true);
  });

  it('rest days do not count toward the floor — covered is not logged', () => {
    const g = weekAtAGlance(
      [day(MON, 1500), day(MON + 1, 1500)], D(MON + 3), T, [D(MON + 2)]);
    expect(g.restedDays).toBe(1);
    expect(g.weeklyFloorHit).toBe(false);
  });

  it('half-logged days do not count either (spec 0012 carries through)', () => {
    const g = weekAtAGlance(
      [day(MON, 1500), day(MON + 1, 1500), day(MON + 2, 150)], D(MON + 3), T);
    expect(g.loggedDays).toBe(2);
    expect(g.weeklyFloorHit).toBe(false);
  });
});

describe('E-04 · quiet re-entry', () => {
  const days3 = [D(0), D(1), D(2)];

  it('a short gap keeps the warm, specific comeback', () => {
    const c = comebackNote(days3, D(7), computeStreak(days3, D(7)))!;
    expect(c.title).toBe('Welcome back — 4 days off');
    expect(c.body).toContain('best run is 3 days');
  });

  it('at the quiet threshold the card loses every number', () => {
    expect(COMEBACK_QUIET_GAP_DAYS).toBe(30);
    const c = comebackNote(days3, D(2 + 31), computeStreak(days3, D(2 + 31)))!;
    expect(c.title).toBe('Good to see you');
    expect(/\d/.test(c.title + c.body)).toBe(false);   // NO digits anywhere
    expect(c.body).not.toMatch(/best run/i);
    expect(c.daysAway).toBe(30);                       // the data survives for tests/telemetry
  });

  it('a two-year absence gets the same quiet card', () => {
    const c = comebackNote(['2024-06-01'], '2026-06-01', computeStreak(['2024-06-01'], '2026-06-01'))!;
    expect(c.title).toBe('Good to see you');
    expect(/\d/.test(c.title + c.body)).toBe(false);
  });

  it('29 days away is still the named gap; 30 is quiet — the boundary is exact', () => {
    const warm = comebackNote(days3, D(2 + 30), computeStreak(days3, D(2 + 30)))!;
    expect(warm.title).toBe('Welcome back — 29 days off');
    const quiet = comebackNote(days3, D(2 + 31), computeStreak(days3, D(2 + 31)))!;
    expect(quiet.title).toBe('Good to see you');
  });
});
