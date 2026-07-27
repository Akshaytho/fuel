import { FoodPer100g, LogEntryInput, Macros, assertNonNegativeFinite } from './types.js';

/** Atwater factors (kcal per gram). */
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export const kcalOfProtein = (g: number): number => g * KCAL_PER_G.protein;
export const kcalOfCarbs = (g: number): number => g * KCAL_PER_G.carbs;
export const kcalOfFat = (g: number): number => g * KCAL_PER_G.fat;
export const kcalToCarbs_g = (kcal: number): number => kcal / KCAL_PER_G.carbs;
export const kcalToFat_g = (kcal: number): number => kcal / KCAL_PER_G.fat;

/** Half-up rounding to 1 decimal, stable for typical nutrition magnitudes. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function kcalFromMacros(m: Pick<Macros, 'protein_g' | 'carbs_g' | 'fat_g'>): number {
  return kcalOfProtein(m.protein_g) + kcalOfCarbs(m.carbs_g) + kcalOfFat(m.fat_g);
}

/**
 * Honesty check (spec 0001 / ADR-016): does a food record's stated kcal agree
 * with its macros within tolerance? Flags dirty DB records for review.
 */
export function kcalMismatch(per100g: FoodPer100g, tolerance = 0.08): boolean {
  const computed = kcalFromMacros(per100g);
  if (per100g.kcal === 0) return computed > 0;
  return Math.abs(computed - per100g.kcal) / per100g.kcal > tolerance;
}

/** Scale a per-100g record to an actual logged amount in grams. */
export function scalePer100g(per100g: FoodPer100g, grams: number): Macros {
  assertNonNegativeFinite('grams', grams);
  assertNonNegativeFinite('kcal', per100g.kcal);
  assertNonNegativeFinite('protein_g', per100g.protein_g);
  assertNonNegativeFinite('carbs_g', per100g.carbs_g);
  assertNonNegativeFinite('fat_g', per100g.fat_g);
  const f = grams / 100;
  return {
    kcal: Math.round(per100g.kcal * f),
    protein_g: round1(per100g.protein_g * f),
    carbs_g: round1(per100g.carbs_g * f),
    fat_g: round1(per100g.fat_g * f),
  };
}

/** Sum any number of macro sets (e.g. a day's entries). */
export function sumMacros(items: readonly Macros[]): Macros {
  const total = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const m of items) {
    total.kcal += m.kcal;
    total.protein_g += m.protein_g;
    total.carbs_g += m.carbs_g;
    total.fat_g += m.fat_g;
  }
  return {
    kcal: Math.round(total.kcal),
    protein_g: round1(total.protein_g),
    carbs_g: round1(total.carbs_g),
    fat_g: round1(total.fat_g),
  };
}

/** Convenience: scale a set of log-entry inputs and sum them. */
export function consumedFromEntries(entries: readonly LogEntryInput[]): Macros {
  return sumMacros(entries.map((e) => scalePer100g(e.per100g, e.grams)));
}
