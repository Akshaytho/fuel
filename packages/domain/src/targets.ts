import {
  ActivityLevel, Goal, Profile, Targets,
  assertPositiveFinite,
} from './types';
import { round1, kcalOfProtein, kcalOfFat, kcalToCarbs_g, kcalToFat_g } from './macros';

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose: -0.20,
  maintain: 0,
  gain: 0.10,
};

/** Safety floor: never produce a plan below this (ADR/spec 0001 case grid). */
export const KCAL_FLOOR = 1200;

/** Protein target in grams per kg body weight. */
export const PROTEIN_G_PER_KG = 1.8;

/** Fraction of calories allocated to fat. */
export const FAT_KCAL_FRACTION = 0.30;

/** Mifflin–St Jeor basal metabolic rate (kcal/day). */
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
 * Daily targets: goal-adjusted TDEE, protein by body weight, fat as a
 * fraction of calories, carbs as the remainder (floored at 0).
 */
export function computeTargets(p: Profile): Targets {
  const rawKcal = tdee(p) * (1 + GOAL_ADJUSTMENT[p.goal]);
  const clamped = rawKcal < KCAL_FLOOR;
  const kcal = clamped ? KCAL_FLOOR : rawKcal;

  const protein_g = PROTEIN_G_PER_KG * p.weight_kg;
  const proteinKcal = kcalOfProtein(protein_g);
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
