import { describe, it, expect } from 'vitest';
import { usualFor, usualDayFor, EASY_MIN_MEALS, EASY_GOTO_MIN_COUNT } from '../src/easyday';
import type { LoggedItem } from '../src/gotos';

/** Spec 0016. The evidence this encodes: simplified logging produced 97% of
    days tracked vs 49%, with identical outcomes. One tap must therefore write
    ONLY what the history genuinely supports — never an invented day. */

const D = (n: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};
const item = (
  name: string, day: string, meal: LoggedItem['meal'], grams = 100, kcal = 100,
): LoggedItem => ({
  food_id: null, food_name: name, grams, kcal,
  protein_g: kcal / 20, carbs_g: kcal / 10, fat_g: kcal / 40,
  meal, day, logged_at: `${day}T08:00:00.000Z`,
});

/** the same 2-item breakfast + 1-food dinner, n days running */
const habit = (n: number): LoggedItem[] => Array.from({ length: n }, (_, i) => [
  item('Oats', D(i), 'breakfast', 60, 230),
  item('Banana', D(i), 'breakfast', 120, 105),
  item('Dal', D(i), 'dinner', 250, 300),
]).flat();

describe('what counts as a usual meal', () => {
  it('a repeat combo is the usual for its slot', () => {
    const u = usualFor(habit(3), 'breakfast', D(3))!;
    expect(u.basis).toBe('combo');
    expect(u.items.map((i) => i.food_name).sort()).toEqual(['Banana', 'Oats']);
    expect(u.kcal).toBe(335);
  });

  it('a single food repeated 3+ times is a usual too (the combo engine ignores solo foods)', () => {
    const u = usualFor(habit(3), 'dinner', D(3))!;
    expect(u.basis).toBe('goto');
    expect(u.items).toHaveLength(1);
    expect(u.items[0]!.food_name).toBe('Dal');
  });

  it('two occurrences of a solo food is NOT a usual', () => {
    expect(usualFor(habit(2), 'dinner', D(2))).toBeNull();
    expect(EASY_GOTO_MIN_COUNT).toBe(3);
  });

  it('a slot with no habit at all has no usual', () => {
    expect(usualFor(habit(5), 'lunch', D(5))).toBeNull();
  });
});

describe('what counts as a usual DAY', () => {
  it('two established slots make a day', () => {
    const d = usualDayFor(habit(3), D(3))!;
    expect(d.meals.map((m) => m.meal)).toEqual(['breakfast', 'dinner']);
    expect(d.label).toBe('Breakfast + Dinner');
    expect(d.kcal).toBe(635);
    expect(d.complete).toBe(true);
    expect(EASY_MIN_MEALS).toBe(2);
  });

  it('ONE established slot is not a day — that is what repeat meals is for', () => {
    const breakfastOnly = habit(3).filter((e) => e.meal === 'breakfast');
    expect(usualDayFor(breakfastOnly, D(3))).toBeNull();
  });

  it('a brand-new user is offered nothing — no invented usual', () => {
    expect(usualDayFor([], D(0))).toBeNull();
  });

  it('offers only the REMAINDER once a slot is logged today', () => {
    const today = D(3);
    const entries = [...habit(3), item('Eggs', today, 'breakfast', 100, 150)];
    const d = usualDayFor(entries, today)!;
    expect(d.meals.map((m) => m.meal)).toEqual(['dinner']);
    expect(d.label).toBe('Dinner');
    expect(d.complete).toBe(false);
  });

  it('offers nothing when every established slot is already logged today', () => {
    const today = D(3);
    const entries = [
      ...habit(3),
      item('Eggs', today, 'breakfast', 100, 150),
      item('Rice', today, 'dinner', 200, 260),
    ];
    expect(usualDayFor(entries, today)).toBeNull();
  });

  it("today's own logs never teach the usual (no same-day echo)", () => {
    // two history days + a third occurrence logged TODAY: still not established,
    // because the day being logged cannot vouch for itself
    const today = D(2);
    const entries = [...habit(2), item('Dal', today, 'dinner', 250, 300),
      item('Oats', today, 'breakfast', 60, 230), item('Banana', today, 'breakfast', 120, 105)];
    expect(usualDayFor(entries, today)).toBeNull();
  });
});

describe('portions stay honest', () => {
  it('logs the MEDIAN portion, exactly like a repeat-meal tap', () => {
    const days = [60, 62, 300].flatMap((g, i) => [
      item('Oats', D(i), 'breakfast', g, g * 3.8),
      item('Banana', D(i), 'breakfast', 120, 105),
      item('Dal', D(i), 'dinner', 250, 300),
    ]);
    const d = usualDayFor(days, D(3))!;
    const oats = d.meals.find((m) => m.meal === 'breakfast')!.items.find((i) => i.food_name === 'Oats')!;
    expect(oats.grams).toBe(62);            // not the 300 g outlier morning
  });
});

describe('rule 0c — two years of history', () => {
  it('computes inside the perf budget on a heavy log', () => {
    const entries: LoggedItem[] = [];
    for (let d = 0; d < 730; d += 1) {
      for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
        for (let k = 0; k < 2; k += 1) entries.push(item(`F${(d + k) % 30}`, D(d), meal, 100, 150));
      }
    }
    const t0 = Date.now();
    const d = usualDayFor(entries, D(730));
    expect(Date.now() - t0).toBeLessThan(250);
    expect(d).not.toBeNull();
  });

  it('is deterministic under reordering', () => {
    const a = usualDayFor(habit(4), D(4))!;
    const b = usualDayFor([...habit(4)].reverse(), D(4))!;
    expect(a.label).toBe(b.label);
    expect(a.kcal).toBe(b.kcal);
  });
});
