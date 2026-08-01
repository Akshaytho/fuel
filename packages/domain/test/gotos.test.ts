import { describe, it, expect } from 'vitest';
import { goTosForMeal, yesterdaysItems, foodKey, type LoggedItem } from '../src/gotos';

const TODAY = '2026-08-05';
const mk = (over: Partial<LoggedItem> & { day: string; food_name: string }): LoggedItem => ({
  food_id: null, grams: 100, kcal: 200, protein_g: 10, carbs_g: 20, fat_g: 5,
  meal: 'breakfast', logged_at: `${over.day}T08:00:00.000Z`, ...over,
});

describe('foodKey identity', () => {
  it('prefers the database id; falls back to a normalized name', () => {
    expect(foodKey({ food_id: 'abc', food_name: 'Oats' })).toBe('abc');
    expect(foodKey({ food_id: null, food_name: '  Oats  ' }))
      .toBe(foodKey({ food_id: null, food_name: 'oats' }));
    expect(foodKey({ food_id: 'abc', food_name: 'Oats' }))
      .not.toBe(foodKey({ food_id: 'xyz', food_name: 'Oats' }));
  });
});

describe('goTosForMeal — the user\'s OWN history, ranked', () => {
  const history: LoggedItem[] = [
    // breakfast regulars
    ...Array.from({ length: 5 }, (_, i) => mk({ day: `2026-08-0${i + 1}`, food_name: 'Oats', food_id: 'oats', meal: 'breakfast' })),
    ...Array.from({ length: 3 }, (_, i) => mk({ day: `2026-08-0${i + 1}`, food_name: 'Eggs', food_id: 'eggs', meal: 'breakfast' })),
    // a dinner regular — should NOT outrank breakfast foods at breakfast
    ...Array.from({ length: 9 }, (_, i) => mk({ day: `2026-07-2${i}`, food_name: 'Chicken', food_id: 'chk', meal: 'dinner' })),
  ];

  it('meal-specific foods come first, ordered by how often', () => {
    const g = goTosForMeal(history, 'breakfast', TODAY);
    expect(g.map((x) => x.food_name).slice(0, 2)).toEqual(['Oats', 'Eggs']);
    expect(g[0]!.count).toBe(5);
    expect(g[0]!.mealMatch).toBe(true);
  });

  it('other-meal foods still fill remaining slots (never uselessly empty)', () => {
    const g = goTosForMeal(history, 'breakfast', TODAY);
    expect(g.map((x) => x.food_name)).toContain('Chicken');
    expect(g.find((x) => x.food_name === 'Chicken')!.mealMatch).toBe(false);
  });

  it('at dinner, the dinner regular leads', () => {
    const g = goTosForMeal(history, 'dinner', TODAY);
    expect(g[0]!.food_name).toBe('Chicken');
    expect(g[0]!.mealMatch).toBe(true);
  });

  it('returns the MOST RECENT logging so a re-log reproduces last time', () => {
    const varied: LoggedItem[] = [
      mk({ day: '2026-08-01', food_name: 'Rice', food_id: 'rice', grams: 100, kcal: 130 }),
      mk({ day: '2026-08-03', food_name: 'Rice', food_id: 'rice', grams: 250, kcal: 325 }),
    ];
    const g = goTosForMeal(varied, 'breakfast', TODAY);
    expect(g[0]!.grams).toBe(250);
    expect(g[0]!.kcal).toBe(325);
    expect(g[0]!.count).toBe(2);
  });

  it('respects the limit and the 60-day window', () => {
    const old = mk({ day: '2026-01-01', food_name: 'Ancient', food_id: 'old' });
    const g = goTosForMeal([...history, old], 'breakfast', TODAY, 2);
    expect(g).toHaveLength(2);
    expect(g.map((x) => x.food_name)).not.toContain('Ancient');
  });

  it('a brand-new user gets an empty list, not a fabricated one', () => {
    expect(goTosForMeal([], 'lunch', TODAY)).toEqual([]);
  });

  it('ties break by recency', () => {
    const tie: LoggedItem[] = [
      mk({ day: '2026-08-01', food_name: 'A', food_id: 'a' }),
      mk({ day: '2026-08-04', food_name: 'B', food_id: 'b' }),
    ];
    expect(goTosForMeal(tie, 'breakfast', TODAY)[0]!.food_name).toBe('B');
  });
});

describe('yesterdaysItems — copy yesterday', () => {
  const entries: LoggedItem[] = [
    mk({ day: '2026-08-04', food_name: 'Toast', logged_at: '2026-08-04T08:00:00Z', meal: 'breakfast' }),
    mk({ day: '2026-08-04', food_name: 'Soup', logged_at: '2026-08-04T13:00:00Z', meal: 'lunch' }),
    mk({ day: '2026-08-05', food_name: 'Today thing' }),
    mk({ day: '2026-08-03', food_name: 'Older thing' }),
  ];

  it('returns exactly yesterday, in the order it was eaten', () => {
    const y = yesterdaysItems(entries, TODAY);
    expect(y.map((e) => e.food_name)).toEqual(['Toast', 'Soup']);
  });

  it('crosses a month boundary correctly', () => {
    const e = [mk({ day: '2026-07-31', food_name: 'Last of July' })];
    expect(yesterdaysItems(e, '2026-08-01').map((x) => x.food_name)).toEqual(['Last of July']);
  });

  it('empty when yesterday was skipped — nothing invented', () => {
    expect(yesterdaysItems(entries, '2026-08-07')).toEqual([]);
  });
});
