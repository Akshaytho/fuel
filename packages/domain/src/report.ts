/**
 * Weekly report + adaptive TDEE (spec 0010). Pure, platform-free.
 *
 * The one honest number a tracker can compute that formulas cannot:
 * measured burn from energy balance — what you ate vs what your weight
 * actually did. 7700 kcal ≈ 1 kg of tissue (standard clinical constant).
 */
import { Profile, Targets } from './types';
import {
  tdee as formulaTdee, KCAL_FLOOR,
  DEFICIT_FRACTION, DEFICIT_KCAL_CAP, SURPLUS_FRACTION, SURPLUS_KCAL_CAP,
  PROTEIN_G_PER_KG, PROTEIN_KCAL_FRACTION_CAP, FAT_KCAL_FRACTION, referenceWeightKg,
} from './targets';
import { kcalOfProtein, kcalToCarbs_g, kcalToFat_g, round1 } from './macros';
import { addDays, mondayOf, smoothWeights, type WeightPoint, type DayValue } from './trends';
import { daysBetween } from './streak';

export const KCAL_PER_KG = 7700;
/** A single week may not move the estimate beyond ±30% of the formula. */
export const TDEE_BLEND_CLAMP = 0.30;
export const MIN_LOGGED_DAYS = 4;
export const MIN_WEIGH_SPAN_DAYS = 5;

export interface WeeklyGoalBand { min: number; max: number }
/** kg/week bands per goal (spec 0010 verdict section). */
export function goalBand(goal: Profile['goal']): WeeklyGoalBand {
  if (goal === 'lose') return { min: -0.8, max: -0.2 };
  if (goal === 'gain') return { min: 0.1, max: 0.5 };
  return { min: -0.25, max: 0.25 };
}

export type Verdict = 'on_pace' | 'faster' | 'slower' | 'insufficient';

export interface WeeklyReportInput {
  profile: Profile;
  currentTargets: Targets;
  /** local day the user started (for week numbering) */
  startDay: string;
  /** any day inside the week being reported (usually "yesterday's week") */
  today: string;
  /** kcal totals per day (0 = not logged) covering at least the report week */
  dayKcal: readonly DayValue[];
  /** all weigh-ins (day, kg) */
  weighIns: readonly WeightPoint[];
}

export interface WeeklyReport {
  weekNumber: number;
  weekStart: string;            // Monday
  weekEnd: string;              // Sunday
  loggedDays: number;           // 0–7
  loggedFlags: boolean[];       // Mon..Sun, for the 7 pills
  verdict: Verdict;
  /** measured Δ of the SMOOTHED weight across the window, kg (null if gated) */
  deltaKg: number | null;
  /** why the report is locked, when verdict === 'insufficient' */
  missing: { loggedDays?: number; weighSpanDays?: number } | null;
  measuredTdee: number | null;
  formulaTdee: number;
  /** measured, clamped to ±30% of formula — what proposals are built on */
  blendedTdee: number | null;
  proposedTargets: Targets | null;
  weeklyGoalKg: number;         // the band midpoint the user signed up for
}

/** The most recent COMPLETE week (Mon–Sun strictly before today's week). */
export function lastCompleteWeek(today: string): { start: string; end: string } {
  const start = addDays(mondayOf(today), -7);
  return { start, end: addDays(start, 6) };
}

/** Targets built on a MEASURED tdee — same deltas, floors, and macro split
    as the formula engine (research 0001), sharing its constants. */
export function targetsFromTdee(measuredTdee: number, p: Profile): Targets {
  const delta =
    p.goal === 'lose' ? -Math.min(DEFICIT_FRACTION * measuredTdee, DEFICIT_KCAL_CAP) :
    p.goal === 'gain' ? Math.min(SURPLUS_FRACTION * measuredTdee, SURPLUS_KCAL_CAP) : 0;
  const rawKcal = measuredTdee + delta;
  const floor = KCAL_FLOOR[p.sex];
  const clamped = rawKcal < floor;
  const kcal = clamped ? floor : rawKcal;
  const proteinByWeight = PROTEIN_G_PER_KG[p.goal] * referenceWeightKg(p);
  const proteinKcal = Math.min(kcalOfProtein(proteinByWeight), PROTEIN_KCAL_FRACTION_CAP * kcal);
  const fatKcal = FAT_KCAL_FRACTION * kcal;
  return {
    kcal: Math.round(kcal),
    protein_g: round1(proteinKcal / 4),
    carbs_g: round1(kcalToCarbs_g(Math.max(0, kcal - proteinKcal - fatKcal))),
    fat_g: round1(kcalToFat_g(fatKcal)),
    clamped,
  };
}

export function weeklyReport(input: WeeklyReportInput): WeeklyReport {
  const { profile, startDay, today, dayKcal, weighIns } = input;
  const { start, end } = lastCompleteWeek(today);
  const weekNumber = Math.max(1, Math.floor(daysBetween(mondayOf(startDay), start) / 7) + 1);

  // days logged (Mon..Sun pills)
  const kcalByDay = new Map(dayKcal.map((d) => [d.day, d.value]));
  const loggedFlags = Array.from({ length: 7 }, (_, i) => (kcalByDay.get(addDays(start, i)) ?? 0) > 0);
  const loggedDays = loggedFlags.filter(Boolean).length;

  // weigh-in window: the week ±3 days, smoothed endpoints
  const winStart = addDays(start, -3);
  const winEnd = addDays(end, 3);
  const window = weighIns.filter((w) => {
    const a = daysBetween(winStart, w.day);
    const b = daysBetween(w.day, winEnd);
    return Number.isFinite(a) && a >= 0 && Number.isFinite(b) && b >= 0;
  });
  const span = window.length >= 2
    ? daysBetween(window.map((w) => w.day).sort()[0]!, window.map((w) => w.day).sort().slice(-1)[0]!)
    : 0;

  const fTdee = Math.round(formulaTdee(profile));
  const band = goalBand(profile.goal);
  const weeklyGoalKg = round1((band.min + band.max) / 2);

  const missing: WeeklyReport['missing'] = {};
  if (loggedDays < MIN_LOGGED_DAYS) missing.loggedDays = MIN_LOGGED_DAYS - loggedDays;
  if (span < MIN_WEIGH_SPAN_DAYS) missing.weighSpanDays = MIN_WEIGH_SPAN_DAYS - span;

  if (missing.loggedDays !== undefined || missing.weighSpanDays !== undefined) {
    return {
      weekNumber, weekStart: start, weekEnd: end, loggedDays, loggedFlags,
      verdict: 'insufficient', deltaKg: null, missing,
      measuredTdee: null, formulaTdee: fTdee, blendedTdee: null,
      proposedTargets: null, weeklyGoalKg,
    };
  }

  // measured energy balance over the actual weigh-in span
  const smoothed = smoothWeights(window);
  const first = smoothed[0]!;
  const last = smoothed[smoothed.length - 1]!;
  const spanDays = Math.max(1, daysBetween(first.day, last.day));
  // RAW delta for the physics — rounding here first cost up to ~385 kcal of
  // accuracy (found by the hand-computed test). Display rounds at the edge.
  const rawDeltaKg = last.trendKg - first.trendKg;

  const loggedVals = Array.from({ length: 7 }, (_, i) => kcalByDay.get(addDays(start, i)) ?? 0)
    .filter((v) => v > 0);
  const avgIntake = loggedVals.reduce((a, b) => a + b, 0) / loggedVals.length;

  const measured = Math.round(avgIntake - (rawDeltaKg * KCAL_PER_KG) / spanDays);
  const lo = Math.round(fTdee * (1 - TDEE_BLEND_CLAMP));
  const hi = Math.round(fTdee * (1 + TDEE_BLEND_CLAMP));
  const blended = Math.min(hi, Math.max(lo, measured));

  const weeklyRate = round1((rawDeltaKg / spanDays) * 7);
  const verdict: Verdict =
    weeklyRate >= band.min && weeklyRate <= band.max ? 'on_pace'
      : profile.goal === 'gain'
        ? (weeklyRate > band.max ? 'faster' : 'slower')
        : (weeklyRate < band.min ? 'faster' : 'slower');

  return {
    weekNumber, weekStart: start, weekEnd: end, loggedDays, loggedFlags,
    verdict, deltaKg: weeklyRate, missing: null,
    measuredTdee: measured, formulaTdee: fTdee, blendedTdee: blended,
    proposedTargets: targetsFromTdee(blended, profile),
    weeklyGoalKg,
  };
}
