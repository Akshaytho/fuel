import { describe, it, expect } from 'vitest';
import {
  weeklyReport, targetsFromTdee, lastCompleteWeek, goalBand, KCAL_PER_KG,
  type WeeklyReportInput,
} from '../src/report';
import { computeTargets, type Profile } from '../src/index.js';
import { addDays } from '../src/trends';

const profile: Profile = {
  sex: 'male', age_years: 32, height_cm: 178, weight_kg: 79,
  activity: 'light', goal: 'lose',
};
// formula TDEE: BMR = 790+1112.5-160+5 = 1747.5 ×1.375 = 2402.8 → 2403
const TODAY = '2026-08-05';                     // a Wednesday
const WEEK = lastCompleteWeek(TODAY);           // Mon 2026-07-27 … Sun 2026-08-02

const base = (over: Partial<WeeklyReportInput> = {}): WeeklyReportInput => ({
  profile,
  currentTargets: computeTargets(profile),
  startDay: '2026-06-01',
  today: TODAY,
  dayKcal: Array.from({ length: 7 }, (_, i) => ({ day: addDays(WEEK.start, i), value: 1900 })),
  weighIns: [
    { day: addDays(WEEK.start, 0), kg: 79.5 },
    { day: addDays(WEEK.start, 3), kg: 79.2 },
    { day: addDays(WEEK.start, 6), kg: 79.0 },  // −0.5 over 6 days
  ],
  ...over,
});

describe('lastCompleteWeek / numbering', () => {
  it('reports the Mon–Sun strictly before the current week', () => {
    expect(WEEK).toEqual({ start: '2026-07-27', end: '2026-08-02' });
    // even on a Monday, last complete week is the one just finished
    expect(lastCompleteWeek('2026-08-03')).toEqual({ start: '2026-07-27', end: '2026-08-02' });
  });

  it('week numbering counts from the user start week and survives rollover', () => {
    const r = weeklyReport(base({ startDay: '2026-06-01' }));  // Mon Jun 1
    expect(r.weekNumber).toBe(9);                              // Jun1-week is 1 … Jul27-week is 9
    const nyr = weeklyReport(base({ startDay: '2026-12-21', today: '2027-01-06' }));
    expect(nyr.weekStart).toBe('2026-12-28');                  // ISO week 53
    expect(nyr.weekNumber).toBe(2);
  });
});

describe('energy-balance math (hand-computed)', () => {
  it('measured TDEE = avg intake − Δkg×7700/span', () => {
    const r = weeklyReport(base());
    // smoothing window=7 over 3 points: endpoints average with neighbors:
    // first trend=(79.5+79.2)/2=79.35, last=(79.2+79.0)/2=79.1 → Δ=-0.25 over 6d
    expect(r.deltaKg).toBeCloseTo(-0.3, 1);       // weekly rate −0.29→−0.3
    const expectedMeasured = Math.round(1900 - (-0.25 * KCAL_PER_KG) / 6);
    expect(r.measuredTdee).toBe(expectedMeasured); // 1900 + 320.8 → 2221
    expect(r.verdict).toBe('on_pace');             // −0.3 within lose band
    expect(r.loggedDays).toBe(7);
  });

  it('the blend clamp stops one crazy week from moving targets ±30%+', () => {
    // absurd: claims eating 800/day while GAINING — measured TDEE collapses
    const r = weeklyReport(base({
      dayKcal: Array.from({ length: 7 }, (_, i) => ({ day: addDays(WEEK.start, i), value: 800 })),
      weighIns: [
        { day: WEEK.start, kg: 79.0 },
        { day: addDays(WEEK.start, 6), kg: 80.2 },
      ],
    }));
    expect(r.measuredTdee).toBeLessThan(0.7 * r.formulaTdee); // raw estimate is absurd
    expect(r.blendedTdee).toBe(Math.round(r.formulaTdee * 0.7)); // clamped to the floor
    expect(r.proposedTargets).not.toBeNull();
  });

  it('proposed targets share the safety engine: floors, caps, macro sum', () => {
    const t = targetsFromTdee(5600, { ...profile, weight_kg: 180, height_cm: 200 });
    expect(t.kcal).toBe(5600 - 1000);              // deficit cap, not 20% (=1120)
    const sum = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
    expect(Math.abs(sum - t.kcal)).toBeLessThanOrEqual(3);
    const tiny = targetsFromTdee(1400, { ...profile, sex: 'male' });
    expect(tiny.kcal).toBe(1500);                  // male floor beats measured
    expect(tiny.clamped).toBe(true);
  });
});

describe('honest gates', () => {
  it('3 logged days → locked, says exactly how many more are needed', () => {
    const r = weeklyReport(base({
      dayKcal: Array.from({ length: 3 }, (_, i) => ({ day: addDays(WEEK.start, i), value: 1900 })),
    }));
    expect(r.verdict).toBe('insufficient');
    expect(r.missing).toEqual({ loggedDays: 1 });
    expect(r.proposedTargets).toBeNull();
    expect(r.loggedFlags).toEqual([true, true, true, false, false, false, false]);
  });

  it('weigh-ins too close together → locked with the span shortfall', () => {
    const r = weeklyReport(base({
      weighIns: [
        { day: addDays(WEEK.start, 2), kg: 79.3 },
        { day: addDays(WEEK.start, 3), kg: 79.2 },
      ],
    }));
    expect(r.verdict).toBe('insufficient');
    expect(r.missing?.weighSpanDays).toBe(4);
  });

  it('weigh-ins OUTSIDE the ±3-day window are ignored (ancient data is not this week)', () => {
    const r = weeklyReport(base({
      weighIns: [
        { day: '2026-06-01', kg: 82 }, { day: TODAY, kg: 79 },  // today is past week+3? no: end+3 = Aug 5 → inside
      ],
    }));
    // 2026-06-01 excluded → only one point in window → span 0 → locked
    expect(r.verdict).toBe('insufficient');
  });
});

describe('verdict bands', () => {
  const week = (rate: number): WeeklyReportInput => base({
    weighIns: [
      { day: WEEK.start, kg: 80 },
      { day: addDays(WEEK.start, 6), kg: round2(80 + (rate * 6) / 7) },
    ],
  });
  const round2 = (n: number) => Math.round(n * 100) / 100;

  it('lose: −1.2 kg/wk = faster; −0.05 = slower; −0.4 = on pace', () => {
    expect(weeklyReport(week(-1.2)).verdict).toBe('faster');
    expect(weeklyReport(week(-0.05)).verdict).toBe('slower');
    expect(weeklyReport(week(-0.4)).verdict).toBe('on_pace');
  });

  it('gain: +0.8 = faster; −0.2 = slower (goal-aware direction)', () => {
    const gain = { ...profile, goal: 'gain' as const };
    expect(weeklyReport({ ...week(0.8), profile: gain }).verdict).toBe('faster');
    expect(weeklyReport({ ...week(-0.2), profile: gain }).verdict).toBe('slower');
  });

  it('bands themselves are sane and goal-symmetric where they should be', () => {
    expect(goalBand('lose').max).toBeLessThan(0);
    expect(goalBand('gain').min).toBeGreaterThan(0);
    expect(goalBand('maintain').min).toBe(-goalBand('maintain').max);
  });
});
