import { describe, it, expect } from 'vitest';
import { repeatMealsFor, REPEAT_MIN_DAYS, REPEAT_WINDOW_DAYS } from '../src/combos';
import type { LoggedItem } from '../src/gotos';

const D = (n: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

const item = (
  name: string, day: string, meal: LoggedItem['meal'] = 'breakfast',
  grams = 100, kcal = 100, id: string | null = null,
): LoggedItem => ({
  food_id: id, food_name: name, grams, kcal,
  protein_g: kcal / 20, carbs_g: kcal / 10, fat_g: kcal / 40,
  meal, day, logged_at: `${day}T08:00:00.000Z`,
});

/** the same breakfast on n days, starting at day 0 */
const porridgeDays = (n: number, meal: LoggedItem['meal'] = 'breakfast') =>
  Array.from({ length: n }, (_, i) => [
    item('Oats', D(i), meal, 60, 230),
    item('Banana', D(i), meal, 120, 105),
    item('Milk', D(i), meal, 200, 96),
  ]).flat();

describe('what counts as a repeat', () => {
  it('offers a combination eaten on three days', () => {
    const r = repeatMealsFor(porridgeDays(3), 'breakfast', D(2));
    expect(r).toHaveLength(1);
    expect(r[0]!.label).toBe('Banana + Milk + Oats');
    expect(r[0]!.days).toBe(3);
    expect(r[0]!.items).toHaveLength(3);
    expect(r[0]!.kcal).toBe(431);
  });

  it('does NOT offer one eaten on only two days', () => {
    expect(repeatMealsFor(porridgeDays(2), 'breakfast', D(1))).toHaveLength(0);
  });

  it('never offers a single food — that is a go-to, not a meal', () => {
    const solo = Array.from({ length: 10 }, (_, i) => item('Banana', D(i)));
    expect(repeatMealsFor(solo, 'breakfast', D(9))).toHaveLength(0);
  });

  it('counts a day once even if the plate was logged twice that morning', () => {
    const days = porridgeDays(3);
    const dupes = days.filter((e) => e.day === D(0));
    const r = repeatMealsFor([...days, ...dupes], 'breakfast', D(2));
    expect(r[0]!.days).toBe(3);
  });

  it('keeps meal slots separate', () => {
    const mixed = [...porridgeDays(3, 'breakfast'), ...porridgeDays(3, 'dinner')];
    expect(repeatMealsFor(mixed, 'breakfast', D(2))).toHaveLength(1);
    expect(repeatMealsFor(mixed, 'lunch', D(2))).toHaveLength(0);
    expect(repeatMealsFor(mixed, 'dinner', D(2))[0]!.meal).toBe('dinner');
  });

  it('treats a superset as its own combination', () => {
    const withCoffee = Array.from({ length: 3 }, (_, i) =>
      [...porridgeDays(1).map((e) => ({ ...e, day: D(10 + i), logged_at: `${D(10 + i)}T08:00:00.000Z` })),
       item('Coffee', D(10 + i), 'breakfast', 240, 5)]).flat();
    const r = repeatMealsFor([...porridgeDays(3), ...withCoffee], 'breakfast', D(12));
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.items.length).sort()).toEqual([3, 4]);
  });

  it('ignores combinations that fell out of the window', () => {
    const old = porridgeDays(3).map((e) => {
      const day = D(-(REPEAT_WINDOW_DAYS + 10) + Number(e.day.slice(-2)));
      return { ...e, day, logged_at: `${day}T08:00:00.000Z` };
    });
    expect(repeatMealsFor(old, 'breakfast', D(0))).toHaveLength(0);
  });

  it('matches manual entries with no food_id by normalised name', () => {
    const a = porridgeDays(3);
    const b = a.map((e) => ({ ...e, food_name: e.food_name.toUpperCase() + ' ' }));
    // same foods, typed with different case/spacing on alternate days
    const mixed = a.map((e, i) => (i % 2 === 0 ? e : b[i]!));
    expect(repeatMealsFor(mixed, 'breakfast', D(2))).toHaveLength(1);
  });
});

describe('what a tap logs', () => {
  it('uses the MEDIAN grams, so one odd morning does not become the default', () => {
    const days = [
      ...[60, 62, 300].flatMap((g, i) => [
        item('Oats', D(i), 'breakfast', g, g * 3.8),
        item('Banana', D(i), 'breakfast', 120, 105),
      ]),
    ];
    const r = repeatMealsFor(days, 'breakfast', D(2));
    const oats = r[0]!.items.find((i) => i.food_name === 'Oats')!;
    expect(oats.grams).toBe(62);              // not 140.7 (the mean) and not 300
  });

  it('scales macros with the portion it is logging', () => {
    const days = [
      ...[100, 100, 200].flatMap((g, i) => [
        item('Rice', D(i), 'dinner', g, g * 1.3),
        item('Dal', D(i), 'dinner', 150, 180),
      ]),
    ];
    const rice = repeatMealsFor(days, 'dinner', D(2))[0]!.items.find((i) => i.food_name === 'Rice')!;
    expect(rice.grams).toBe(100);
    expect(rice.kcal).toBe(130);              // 1.3 kcal/g held, not the 260 of the last logging
  });

  it('labels itself from the items it logs, so the two cannot disagree', () => {
    const r = repeatMealsFor(porridgeDays(4), 'breakfast', D(3))[0]!;
    expect(r.label).toBe(r.items.map((i) => i.food_name).join(' + '));
  });
});

describe('ranking and limits', () => {
  it('puts the most-repeated combination first', () => {
    const rare = Array.from({ length: 3 }, (_, i) =>
      [item('Toast', D(20 + i), 'breakfast', 40, 110), item('Egg', D(20 + i), 'breakfast', 50, 70)]).flat();
    const r = repeatMealsFor([...porridgeDays(6), ...rare], 'breakfast', D(25));
    expect(r[0]!.days).toBe(6);
    expect(r[1]!.days).toBe(3);
  });

  it('returns at most the limit', () => {
    const many = Array.from({ length: 6 }, (_, c) =>
      Array.from({ length: 3 }, (_, i) => [
        item(`A${c}`, D(c * 4 + i), 'lunch', 100, 200),
        item(`B${c}`, D(c * 4 + i), 'lunch', 100, 200),
      ]).flat()).flat();
    expect(repeatMealsFor(many, 'lunch', D(30))).toHaveLength(3);
  });

  it('is deterministic when everything ties', () => {
    const many = Array.from({ length: 4 }, (_, c) =>
      Array.from({ length: 3 }, (_, i) => [
        item(`X${c}`, D(c * 4 + i), 'snack', 100, 200),
        item(`Y${c}`, D(c * 4 + i), 'snack', 100, 200),
      ]).flat()).flat();
    const a = repeatMealsFor(many, 'snack', D(20));
    const b = repeatMealsFor([...many].reverse(), 'snack', D(20));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it('is empty for someone with no history, and does not throw', () => {
    expect(repeatMealsFor([], 'breakfast', D(0))).toEqual([]);
  });
});

describe('rule 0c — two years of logs', () => {
  it('stays inside the perf budget on a heavy history', () => {
    const entries: LoggedItem[] = [];
    for (let d = 0; d < 730; d += 1) {
      for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
        for (let k = 0; k < 3; k += 1) {
          entries.push(item(`F${(d + k) % 40}`, D(d), meal, 100, 150));
        }
      }
    }
    const t0 = Date.now();
    const r = repeatMealsFor(entries, 'lunch', D(729));
    expect(Date.now() - t0).toBeLessThan(120);
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it('REPEAT_MIN_DAYS is the documented 3', () => {
    expect(REPEAT_MIN_DAYS).toBe(3);
  });
});
