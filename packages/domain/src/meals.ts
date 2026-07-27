/** Meal bucketing by local hour (spec 0004). Pure, testable. */
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_ORDER: readonly Meal[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export function mealForHour(hour: number): Meal {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return 'snack';
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 17) return 'snack';
  if (hour < 21) return 'dinner';
  return 'snack';
}
