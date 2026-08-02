import { describe, it, expect } from 'vitest';
import { weeklyReport, classifyDay, PARTIAL_DAY_FRACTION } from '../src/report';
import type { Profile, Targets } from '../src/types';

/**
 * Spec 0012. These tests exist because of a measured, shipped bug: intake was
 * averaged over "days with any logs", so a forgotten dinner counted as a light
 * day of eating and quietly cut the user's recommended target.
 */

const profile: Profile = {
  sex: 'female', age_years: 31, height_cm: 162, weight_kg: 71, activity: 'light', goal: 'lose',
};
const targets: Targets = { kcal: 1547, protein_g: 134, carbs_g: 145, fat_g: 52, clamped: false };
const WEEK = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
const WEIGH = [{ day: '2026-09-07', kg: 71.0 }, { day: '2026-09-13', kg: 70.6 }];

const run = (kcals: number[], confirmedDays: string[] = []) => weeklyReport({
  profile, currentTargets: targets, startDay: '2026-09-01', today: '2026-09-16',
  dayKcal: WEEK.map((day, i) => ({ day, value: kcals[i]! })), weighIns: WEIGH, confirmedDays,
});

describe('classifyDay', () => {
  it('splits none / partial / full at half the target', () => {
    expect(classifyDay(0, 1547)).toBe('none');
    expect(classifyDay(150, 1547)).toBe('partial');
    expect(classifyDay(773, 1547)).toBe('partial');            // 49.97%
    expect(classifyDay(1547 * PARTIAL_DAY_FRACTION, 1547)).toBe('full');  // boundary is inclusive
    expect(classifyDay(1800, 1547)).toBe('full');
  });

  it('never calls a day partial when there is no target to measure against', () => {
    expect(classifyDay(150, 0)).toBe('full');
    expect(classifyDay(150, Number.NaN)).toBe('full');
    expect(classifyDay(Number.NaN, 1547)).toBe('none');
    expect(classifyDay(-5, 1547)).toBe('none');
  });
});

describe('THE BUG: one forgotten dinner used to cut her target by 188 kcal', () => {
  const clean = run([1800, 1800, 1800, 1800, 1800, 1800, 1800]);
  const forgot = run([1800, 1800, 1800, 150, 1800, 1800, 1800]);

  it('no longer moves the measured TDEE at all', () => {
    // Before spec 0012: 2313 vs 2078 — a 235 kcal/day drift she never earned.
    expect(clean.measuredTdee).toBe(2313);
    expect(forgot.measuredTdee).toBe(clean.measuredTdee);
  });

  it('no longer moves the proposed target', () => {
    expect(clean.proposedTargets!.kcal).toBe(1850);
    expect(forgot.proposedTargets!.kcal).toBe(clean.proposedTargets!.kcal);
  });

  it('counts the forgotten day as neither logged nor missed, and names it', () => {
    expect(forgot.loggedDays).toBe(6);
    expect(forgot.dayClasses[3]).toBe('partial');
    expect(forgot.excludedDays).toEqual(['2026-09-10']);
  });

  it("but the user's word wins: confirming it restores the old arithmetic exactly", () => {
    const confirmed = run([1800, 1800, 1800, 150, 1800, 1800, 1800], ['2026-09-10']);
    expect(confirmed.loggedDays).toBe(7);
    expect(confirmed.excludedDays).toEqual([]);
    expect(confirmed.measuredTdee).toBe(2078);          // the honest 5:2-faster's number
    expect(confirmed.proposedTargets!.kcal).toBe(1662);
  });
});

describe('the exclusion cannot be used to manufacture a report', () => {
  it('keeps the report locked when only crumbs were logged', () => {
    const r = run([100, 120, 90, 150, 80, 110, 100]);
    expect(r.loggedDays).toBe(0);
    expect(r.verdict).toBe('insufficient');
    expect(r.measuredTdee).toBeNull();
    expect(r.excludedDays).toHaveLength(7);
  });

  it('locks at 3 full days even though 7 days have some logs', () => {
    const r = run([1800, 1800, 1800, 200, 200, 200, 200]);
    expect(r.loggedDays).toBe(3);
    expect(r.verdict).toBe('insufficient');
    expect(r.missing!.loggedDays).toBe(1);
  });

  it('unlocks at exactly 4 full days', () => {
    const r = run([1800, 1800, 1800, 1800, 200, 200, 200]);
    expect(r.loggedDays).toBe(4);
    expect(r.verdict).not.toBe('insufficient');
    // and the average is of the four real days, not diluted by the crumbs
    expect(r.measuredTdee).toBe(2313);
  });

  it('reports classes and excluded days even while locked', () => {
    const r = run([1800, 200, 0, 0, 0, 0, 0]);
    expect(r.dayClasses).toEqual(['full', 'partial', 'none', 'none', 'none', 'none', 'none']);
    expect(r.excludedDays).toEqual(['2026-09-08']);
  });
});

describe('the fix is direction-safe', () => {
  it('a genuinely heavy day is never excluded (the bias only ever cut downward)', () => {
    const r = run([1800, 1800, 1800, 4200, 1800, 1800, 1800]);
    expect(r.excludedDays).toEqual([]);
    expect(r.loggedDays).toBe(7);
  });

  it('excluding is conservative, never generous: it cannot raise loggedDays', () => {
    for (const low of [0, 1, 100, 500, 773]) {
      const r = run([1800, 1800, 1800, low, 1800, 1800, 1800]);
      expect(r.loggedDays).toBe(6);
    }
  });

  it('a clamped-target user (very small profile) still classifies sanely', () => {
    const small: Targets = { ...targets, kcal: 1200, clamped: true };
    const r = weeklyReport({
      profile, currentTargets: small, startDay: '2026-09-01', today: '2026-09-16',
      dayKcal: WEEK.map((day) => ({ day, value: 610 })), weighIns: WEIGH,
    });
    expect(r.dayClasses.every((c) => c === 'full')).toBe(true);   // 610 > 600
  });
});

describe('a whole week of implausibly small days locks instead of proposing', () => {
  it('does not build a target out of seven half-logged days', () => {
    // Deliberate design call (spec 0012): when EVERY logged day looks
    // half-recorded we have no week, and saying so is better than proposing
    // targets from crumbs. The alternative — trusting the pattern because it
    // is consistent — hands a 1,200 kcal target to someone who simply stopped
    // logging after breakfast for a week.
    const r = run([700, 650, 700, 720, 680, 700, 690]);
    expect(r.verdict).toBe('insufficient');
    expect(r.proposedTargets).toBeNull();
    expect(r.excludedDays).toHaveLength(7);
  });

  it('a genuinely light but plausible week still reports', () => {
    // 1,000 kcal against a 1,547 target is 65% — under-eating, but recorded.
    const r = run([1000, 1000, 1000, 1000, 1000, 1000, 1000]);
    expect(r.verdict).not.toBe('insufficient');
    expect(r.excludedDays).toEqual([]);
  });
});
