/**
 * Custom foods (spec 0018) — validation for a food the user creates.
 *
 * Two principles from the constitution of this codebase apply directly:
 *
 * 1. Honesty about unknowns: fibre is OPTIONAL and an empty field means
 *    NULL, never 0. A person copying a label that has no fibre line must
 *    not be forced to invent a zero.
 *
 * 2. Their word wins: if the calories they typed disagree with what the
 *    macros imply (4/4/9 Atwater), that is a NOTE, never a blocker. Labels
 *    round, regional labels differ (EU carbs exclude fibre, US include it),
 *    and the person holding the packet knows more than our arithmetic.
 *
 * Blocking is reserved for impossibilities: negative numbers, >100 g of a
 * macro per 100 g of food, energy density beyond pure fat.
 */

export interface CustomFoodInput {
  name: string;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  /** null = the label reported no figure. NEVER coerce to 0 (spec 0015). */
  fiber_g_per_100g: number | null;
}

export const CUSTOM_NAME_MAX = 80;
/** Pure fat is ~884 kcal/100 g; nothing edible exceeds this. */
export const KCAL_PER_100G_MAX = 900;
export const MACRO_G_PER_100G_MAX = 100;
/** Below this gap between typed kcal and Atwater kcal, we say nothing. */
export const ATWATER_NOTE_MIN_KCAL = 30;
export const ATWATER_NOTE_MIN_FRACTION = 0.25;

export type CustomFoodIssue =
  | 'name_empty'
  | 'name_long'
  | 'kcal_range'
  | 'protein_range'
  | 'carbs_range'
  | 'fat_range'
  | 'fiber_range';

export interface CustomFoodCheck {
  ok: boolean;
  issues: CustomFoodIssue[];
  /** typed kcal minus macro-implied kcal, when worth mentioning; else null.
      Positive = they typed MORE energy than the macros imply. */
  energyGapKcal: number | null;
}

/** kcal implied by the macros at 4/4/9 (Atwater factors). */
export function atwaterKcal(protein_g: number, carbs_g: number, fat_g: number): number {
  return Math.round(4 * protein_g + 4 * carbs_g + 9 * fat_g);
}

const badNumber = (x: number, max: number) => !Number.isFinite(x) || x < 0 || x > max;

export function checkCustomFood(input: CustomFoodInput): CustomFoodCheck {
  const issues: CustomFoodIssue[] = [];
  const name = input.name.trim();
  if (name.length === 0) issues.push('name_empty');
  else if (name.length > CUSTOM_NAME_MAX) issues.push('name_long');

  if (badNumber(input.kcal_per_100g, KCAL_PER_100G_MAX)) issues.push('kcal_range');
  if (badNumber(input.protein_g_per_100g, MACRO_G_PER_100G_MAX)) issues.push('protein_range');
  if (badNumber(input.carbs_g_per_100g, MACRO_G_PER_100G_MAX)) issues.push('carbs_range');
  if (badNumber(input.fat_g_per_100g, MACRO_G_PER_100G_MAX)) issues.push('fat_range');
  if (input.fiber_g_per_100g !== null
    && badNumber(input.fiber_g_per_100g, MACRO_G_PER_100G_MAX)) issues.push('fiber_range');

  let energyGapKcal: number | null = null;
  if (issues.length === 0) {
    const implied = atwaterKcal(input.protein_g_per_100g, input.carbs_g_per_100g, input.fat_g_per_100g);
    const gap = Math.round(input.kcal_per_100g - implied);
    const threshold = Math.max(ATWATER_NOTE_MIN_KCAL, ATWATER_NOTE_MIN_FRACTION * Math.max(input.kcal_per_100g, implied));
    if (Math.abs(gap) >= threshold) energyGapKcal = gap;
  }

  return { ok: issues.length === 0, issues, energyGapKcal };
}

/**
 * Parse one numeric field of the create form. Empty is null (meaningful for
 * fibre; a required-field decision belongs to the caller). Accepts a decimal
 * comma — half the world types "88,5".
 */
export function parseFoodNumber(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s.length === 0) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
