import { describe, it, expect } from 'vitest';
import { mealForHour } from '../src/meals';

describe('mealForHour (spec 0004 AC1)', () => {
  const cases: Array<[number, string]> = [
    [0, 'breakfast'], [7, 'breakfast'], [10, 'breakfast'],
    [11, 'lunch'], [14, 'lunch'],
    [15, 'snack'], [16, 'snack'],
    [17, 'dinner'], [20, 'dinner'],
    [21, 'snack'], [23, 'snack'],
  ];
  for (const [h, m] of cases) it(`${h}:00 → ${m}`, () => expect(mealForHour(h)).toBe(m));
  it('invalid hours degrade to snack, never throw', () => {
    expect(mealForHour(-1)).toBe('snack');
    expect(mealForHour(24)).toBe('snack');
    expect(mealForHour(NaN)).toBe('snack');
    expect(mealForHour(2.5)).toBe('snack');
  });
});
