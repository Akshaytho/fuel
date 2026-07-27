/** Canonical internal units: grams, kcal. Display conversion is a UI concern. */

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export type Sex = 'male' | 'female';

/** Standard 5-level activity multipliers (Mifflin–St Jeor convention). */
export type ActivityLevel =
  | 'sedentary'      // 1.2
  | 'light'          // 1.375
  | 'moderate'       // 1.55
  | 'active'         // 1.725
  | 'very_active';   // 1.9

export type Goal = 'lose' | 'maintain' | 'gain';

export interface Profile {
  sex: Sex;
  age_years: number;
  height_cm: number;
  weight_kg: number;
  activity: ActivityLevel;
  goal: Goal;
}

export interface Targets extends Macros {
  /** true when the safety floor (1200 kcal) overrode the computed deficit */
  clamped: boolean;
}

/** A food's nutrition per 100 g, as stored in the food database. */
export interface FoodPer100g extends Macros {}

export interface LogEntryInput {
  per100g: FoodPer100g;
  grams: number;
}

export interface DaySummary {
  consumed: Macros;
  remaining: Macros;          // negative components mean "over"
  progress: {                 // consumed / target, uncapped; UI clamps display
    kcal: number; protein: number; carbs: number; fat: number;
  };
  isOver: boolean;            // kcal over target
  entryCount: number;
}

export class DomainError extends Error {
  override name = 'DomainError';
}

export class InvalidInputError extends DomainError {
  override name = 'InvalidInputError';
  constructor(field: string, value: unknown) {
    super(`Invalid ${field}: ${String(value)}`);
  }
}

/** Reject NaN/Infinity/negatives-or-zero where a positive finite number is required. */
export function assertPositiveFinite(field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidInputError(field, value);
  }
}

export function assertNonNegativeFinite(field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidInputError(field, value);
  }
}
