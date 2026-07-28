import {
  ActivityLevel, Goal, Profile, Targets,
  assertPositiveFinite,
} from './types';
import { round1, kcalOfProtein, kcalToCarbs_g, kcalToFat_g } from './macros';

/*
 * Every constant here traces to docs/research/0001-target-math.md.
 * Change a number → update that doc (and the tests) in the same commit.
 */

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Sex-specific safety floors (research §4): below = VLCD, needs a doctor. */
export const KCAL_FLOOR = { female: 1200, male: 1500 } as const;

/** Deficit: 20% of TDEE, capped at ~1 kg/week equivalent (research §3). */
export const DEFICIT_FRACTION = 0.20;
export const DEFICIT_KCAL_CAP = 1000;

/** Surplus: 10% of TDEE, capped at the lean-gain ceiling (research §3). */
export const SURPLUS_FRACTION = 0.10;
export const SURPLUS_KCAL_CAP = 500;

/** Protein g per kg of REFERENCE weight, by goal (research §5). */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 2.0,       // deficit → top of the 1.6–2.2 lean-mass-sparing range
  maintain: 1.6,
  gain: 1.8,
};

/** AMDR upper bound for protein — guarantees carbs ≥ 0 (research §5). */
export const PROTEIN_KCAL_FRACTION_CAP = 0.35;

/** Fraction of calories allocated to fat (AMDR mid-range, research §6). */
export const FAT_KCAL_FRACTION = 0.30;

/** Water: 35 ml/kg clamped to sane bounds (research §7). */
export const WATER_L_MIN = 1.5;
export const WATER_L_MAX = 4.0;

/** Mifflin–St Jeor basal metabolic rate (kcal/day) — research §1. */
export function bmr(p: Pick<Profile, 'sex' | 'age_years' | 'height_cm' | 'weight_kg'>): number {
  assertPositiveFinite('age_years', p.age_years);
  assertPositiveFinite('height_cm', p.height_cm);
  assertPositiveFinite('weight_kg', p.weight_kg);
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age_years;
  return p.sex === 'male' ? base + 5 : base - 161;
}

/** Total daily energy expenditure. */
export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY_FACTOR[p.activity];
}

/**
 * Reference weight for protein dosing (research §5): protein turnover lives
 * in fat-free mass, so above BMI 25 we count only 25% of the excess —
 * the standard adjusted-body-weight proxy when body-fat % is unknown.
 */
export function referenceWeightKg(p: Pick<Profile, 'height_cm' | 'weight_kg'>): number {
  assertPositiveFinite('height_cm', p.height_cm);
  assertPositiveFinite('weight_kg', p.weight_kg);
  const h_m = p.height_cm / 100;
  const bmi25Weight = 25 * h_m * h_m;
  if (p.weight_kg <= bmi25Weight) return p.weight_kg;
  return bmi25Weight + 0.25 * (p.weight_kg - bmi25Weight);
}

/**
 * Daily targets (research doc 0001, invariants section):
 * kcal = TDEE ± capped goal adjustment, floored by sex;
 * protein = goal-rate × reference weight, capped at 35% of kcal;
 * fat = 30% of kcal; carbs = exact remainder (≥ 0 by construction).
 */
export function computeTargets(p: Profile): Targets {
  const t = tdee(p);
  const delta =
    p.goal === 'lose' ? -Math.min(DEFICIT_FRACTION * t, DEFICIT_KCAL_CAP) :
    p.goal === 'gain' ? Math.min(SURPLUS_FRACTION * t, SURPLUS_KCAL_CAP) : 0;
  const rawKcal = t + delta;
  const floor = KCAL_FLOOR[p.sex];
  const clamped = rawKcal < floor;
  const kcal = clamped ? floor : rawKcal;

  const proteinByWeight = PROTEIN_G_PER_KG[p.goal] * referenceWeightKg(p);
  const proteinKcal = Math.min(kcalOfProtein(proteinByWeight), PROTEIN_KCAL_FRACTION_CAP * kcal);
  const protein_g = proteinKcal / 4;
  const fatKcal = FAT_KCAL_FRACTION * kcal;
  const fat_g = kcalToFat_g(fatKcal);
  const carbsKcal = Math.max(0, kcal - proteinKcal - fatKcal);
  const carbs_g = kcalToCarbs_g(carbsKcal);

  return {
    kcal: Math.round(kcal),
    protein_g: round1(protein_g),
    carbs_g: round1(carbs_g),
    fat_g: round1(fat_g),
    clamped,
  };
}

/** Daily water target: 35 ml/kg, clamped, rounded to 0.25 L (research §7). */
export function waterLitersFor(weight_kg: number): number {
  assertPositiveFinite('weight_kg', weight_kg);
  const raw = Math.min(WATER_L_MAX, Math.max(WATER_L_MIN, weight_kg * 0.035));
  return Math.round(raw * 4) / 4;
}
