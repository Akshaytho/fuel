/**
 * CLAUDE.md rule 0c — the TWO-YEAR LIFE REVIEW, executable.
 *
 * Simulated humans live 730+ days through the REAL domain functions. The span
 * 2026-08-01 → 2028-07-30 deliberately contains: two New Years, leap day
 * 2028-02-29, US DST spring-forward (2027-03-14) and fall-back (2027-11-07),
 * and ISO week 53 of 2026 (Mon 2026-12-28). Every assertion is a claim a
 * real user could check against their own life.
 */
import { describe, it, expect } from 'vitest';
import {
  computeStreak, dayNumber, daysBetween, addDays, mondayOf, localDayISO,
  smoothWeights, weeklySlopeKgPerWeek, dailyTotals, proteinDaysByWeek, loggedPercent,
  computeTargets, summarizeConsumed, type Profile,
} from '../src/index.js';

const START = '2026-08-01';
const DAYS = 730;
const END = addDays(START, DAYS - 1);           // 2028-07-30
const allDays = Array.from({ length: DAYS }, (_, i) => addDays(START, i));

/** Deterministic PRNG so the simulation is reproducible in CI. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('the calendar itself behaves across the span', () => {
  it('contains exactly the special days we claim it does', () => {
    expect(END).toBe('2028-07-30');
    expect(allDays).toContain('2028-02-29');            // leap day exists
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(allDays).toContain('2026-12-28');            // ISO week 53 Monday
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');  // NY 2027 belongs to week 53 of 2026
  });

  it('every consecutive pair is exactly 1 day apart — through DST and leap day', () => {
    for (let i = 1; i < allDays.length; i += 1) {
      expect(daysBetween(allDays[i - 1]!, allDays[i]!)).toBe(1);
    }
  });

  it('Mondays advance by exactly 7 across both year rollovers', () => {
    let m = mondayOf(START);
    const mondays: string[] = [];
    while (daysBetween(m, END) >= 0) { mondays.push(m); m = addDays(m, 7); }
    for (let i = 1; i < mondays.length; i += 1) {
      expect(daysBetween(mondays[i - 1]!, mondays[i]!)).toBe(7);
      expect(mondayOf(mondays[i]!)).toBe(mondays[i]!);
    }
    expect(mondays.length).toBeGreaterThanOrEqual(104);
  });

  it('day numbers: the 730th morning reads "Day 730", never resets', () => {
    expect(dayNumber(START, START)).toBe(1);
    expect(dayNumber(START, '2027-08-01')).toBe(366);   // year 1 has no leap day
    expect(dayNumber(START, END)).toBe(730);
  });

  it('night-shift logging at 00:30 local files under the local day', () => {
    expect(localDayISO(new Date(2027, 0, 1, 0, 30))).toBe('2027-01-01');
    expect(localDayISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('persona: Meera — logs every single day for two years', () => {
  const proteinByDay = allDays.map((day) => ({ day, value: 140 }));

  it('streak is 730 and it IS her longest', () => {
    const s = computeStreak(allDays, END);
    expect(s.current).toBe(730);
    expect(s.longest).toBe(730);
    expect(s.isLongest).toBe(true);
  });

  it('loggedPercent is exactly 100 — the leap day cannot make it 99 or 101', () => {
    expect(loggedPercent(allDays, START, END)).toBe(100);
  });

  it('weekly protein buckets stay ≤7 across DST fall-back (no double-counted day)', () => {
    const weeks = proteinDaysByWeek(proteinByDay, 130, 106, END);
    for (const w of weeks) {
      expect(w.hitDays).toBeLessThanOrEqual(7);
      expect(w.loggedDays).toBeLessThanOrEqual(7);
    }
    // fully-inside weeks are complete
    expect(weeks[50]!.loggedDays).toBe(7);
  });

  it('full 2-year analytics pipeline stays under a phone-frame budget', () => {
    const entries = allDays.flatMap((day) => [
      { day, value: 520 }, { day, value: 610 }, { day, value: 480 },
    ]);
    const t0 = performance.now();
    computeStreak(entries.map((e) => e.day), END);
    dailyTotals(entries, 14, END);
    dailyTotals(entries, 56, END);
    proteinDaysByWeek(dailyTotals(entries, 56, END), 130, 8, END);
    loggedPercent(entries.map((e) => e.day), START, END);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(250); // 2,190 entries; rendered every state bump
  });
});

describe('persona: Raj — weekdays only, one bad month, comes back', () => {
  const rand = rng(42);
  const rajDays = allDays.filter((d, i) => {
    const dow = (i + 5) % 7;                       // 2026-08-01 is a Saturday
    if (dow === 5 || dow === 6) return false;      // never weekends
    if (d >= '2027-03-01' && d <= '2027-03-24') return false; // the bad month
    return rand() > 0.05;                          // occasional missed weekday
  });

  it('the 3-week gap breaks the streak; the longest run survives in history', () => {
    const s = computeStreak(rajDays, END);
    expect(s.longest).toBeGreaterThanOrEqual(4);   // some full Mon–Fri run exists
    expect(s.longest).toBeLessThanOrEqual(5);      // weekends cap every run
    expect(s.current).toBeLessThanOrEqual(5);
  });

  it('loggedPercent reflects his real life, not a flattering rounding', () => {
    const pct = loggedPercent(rajDays, START, END);
    const exact = Math.round((new Set(rajDays).size / 730) * 100);
    expect(pct).toBe(exact);
    expect(pct).toBeGreaterThan(50);
    expect(pct).toBeLessThan(75);
  });

  it('a user who vanishes for two years still gets a sane, honest screen', () => {
    const s = computeStreak(['2026-08-01', '2026-08-02'], END);
    expect(s.current).toBe(0);                     // no fake streak
    expect(s.longest).toBe(2);                     // history preserved
    expect(dayNumber(START, END)).toBe(730);       // "Day 730", not "Day 1"
    expect(loggedPercent(['2026-08-01', '2026-08-02'], START, END)).toBe(0); // 2/730 rounds to 0 — truthful
  });
});

describe('persona: Chloe — two years of weigh-ins with plateau and regain', () => {
  // loses 0.4 kg/wk for 26 weeks (72→61.6), plateaus 26 weeks, regains 3 kg in year 2
  const weights = allDays.map((day, i) => {
    const week = i / 7;
    let kg: number;
    if (week < 26) kg = 72 - 0.4 * week;
    else if (week < 52) kg = 61.6;
    else kg = 61.6 + 3 * ((week - 52) / 52);
    // daily scale noise ±0.4 kg — the reason smoothing exists
    const noise = Math.sin(i * 2.3) * 0.4;
    return { day, kg: Math.round((kg + noise) * 10) / 10 };
  });

  it('smoothing tames scale noise: trend moves < a third of raw day-to-day jitter', () => {
    const sm = smoothWeights(weights);
    const rawJitter = avgAbsDelta(weights.map((w) => w.kg));
    const trendJitter = avgAbsDelta(sm.map((w) => w.trendKg));
    expect(trendJitter).toBeLessThan(rawJitter / 3);
  });

  it('slope over the loss phase ≈ −0.4; over the plateau ≈ 0 and NEVER "-0"', () => {
    const loss = weights.slice(0, 26 * 7);
    const plateau = weights.slice(27 * 7, 51 * 7);
    expect(weeklySlopeKgPerWeek(loss)).toBeGreaterThan(-0.45);
    expect(weeklySlopeKgPerWeek(loss)).toBeLessThan(-0.35);
    const flat = weeklySlopeKgPerWeek(plateau)!;
    expect(Math.abs(flat)).toBeLessThanOrEqual(0.01);
    expect(Object.is(flat, -0)).toBe(false);       // "-0 kg/week" on screen = trust destroyed
    expect(String(flat)).not.toContain('-0.00');
  });

  it('a BARELY-losing month rounds to +0, never -0 (probe-confirmed escape)', () => {
    // -0.0001 kg/day: Math.round(-0.07)/100 used to yield -0 → "-0 kg/week" on screen
    const tiny = allDays.slice(0, 30).map((day, i) => ({ day, kg: 70 - 0.0001 * i }));
    const s = weeklySlopeKgPerWeek(tiny)!;
    expect(s).toBe(0);
    expect(Object.is(s, -0)).toBe(false);
    expect(s.toLocaleString('en-US')).toBe('0');
  });

  it('a perfectly flat month is not NaN and not negative zero', () => {
    const flat = allDays.slice(0, 30).map((day) => ({ day, kg: 61.6 }));
    const s = weeklySlopeKgPerWeek(flat);
    expect(s).toBe(0);
    expect(Object.is(s, -0)).toBe(false);
    const sm = smoothWeights(flat);
    expect(sm.every((p) => p.trendKg === 61.6)).toBe(true);
  });

  it('2 years of daily weigh-ins smooth within the perf budget', () => {
    const t0 = performance.now();
    smoothWeights(weights);
    weeklySlopeKgPerWeek(weights);
    expect(performance.now() - t0).toBeLessThan(400); // O(n·w) over 730 pts
  });
});

describe('persona: Bob — 152 kg, loses 55 kg over two years, targets follow', () => {
  it('every monthly recomputation obeys every safety invariant', () => {
    for (let month = 0; month <= 24; month += 1) {
      const kg = 152 - (55 * month) / 24;
      const p: Profile = {
        sex: 'male', age_years: 38 + Math.floor(month / 12), height_cm: 178,
        weight_kg: Math.round(kg * 10) / 10, activity: 'light',
        goal: kg > 100 ? 'lose' : 'maintain',
      };
      const t = computeTargets(p);
      expect(t.kcal).toBeGreaterThanOrEqual(1500);            // male floor
      const sum = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
      expect(Math.abs(sum - t.kcal)).toBeLessThanOrEqual(3);  // macros always add up
      expect(t.carbs_g).toBeGreaterThanOrEqual(0);
      expect(t.protein_g).toBeLessThan(230);                  // adjusted weight, no absurd dose
    }
  });

  it('the day he hits goal and switches lose→maintain, calories RISE (never a cliff down)', () => {
    const at100: Profile = { sex: 'male', age_years: 40, height_cm: 178, weight_kg: 100, activity: 'light', goal: 'lose' };
    const t1 = computeTargets(at100);
    const t2 = computeTargets({ ...at100, goal: 'maintain' });
    expect(t2.kcal).toBeGreaterThan(t1.kcal);
  });
});

describe('persona: traveler — IST → PST trip across the DST weekend', () => {
  // Her app stores LOCAL day strings; flying west she "relives" a day, flying
  // east she "skips" one. The contract: whatever local days were stamped,
  // totals bucket exactly there — no day is lost or double-counted.
  it('the same local day logged twice (west flight) sums, not duplicates buckets', () => {
    const d = dailyTotals([
      { day: '2027-03-13', value: 600 },  // logged in Delhi before flying
      { day: '2027-03-13', value: 450 },  // logged again in SF, same local date
      { day: '2027-03-14', value: 500 },  // the US spring-forward day itself
    ], 3, '2027-03-15');
    expect(d.find((x) => x.day === '2027-03-13')!.value).toBe(1050);
    expect(d.find((x) => x.day === '2027-03-14')!.value).toBe(500);
  });

  it('fall-back day (2027-11-07) is one bucket even though it lasted 25 hours', () => {
    const d = dailyTotals([
      { day: '2027-11-07', value: 300 }, { day: '2027-11-07', value: 300 },
    ], 2, '2027-11-08');
    expect(d.find((x) => x.day === '2027-11-07')!.value).toBe(600);
    expect(daysBetween('2027-11-06', '2027-11-08')).toBe(2);
  });
});

describe('summary math stays honest at the extremes', () => {
  it('a 5,000 kcal binge day: progress > 1, remaining negative, no clamp lies', () => {
    const targets = computeTargets({ sex: 'male', age_years: 30, height_cm: 178, weight_kg: 80, activity: 'light', goal: 'maintain' });
    const s = summarizeConsumed({ kcal: 5000, protein_g: 180, carbs_g: 600, fat_g: 180 }, 9, targets);
    expect(s.isOver).toBe(true);
    expect(s.remaining.kcal).toBeLessThan(0);
    expect(s.progress.kcal).toBeGreaterThan(1.5);
    expect(Number.isFinite(s.progress.protein)).toBe(true);
  });
});

function avgAbsDelta(xs: number[]): number {
  let sum = 0;
  for (let i = 1; i < xs.length; i += 1) sum += Math.abs(xs[i]! - xs[i - 1]!);
  return sum / (xs.length - 1);
}
