import { describe, it, expect } from 'vitest';
import {
  smoothWeights, weeklySlopeKgPerWeek, dailyTotals, proteinDaysByWeek,
  loggedPercent, addDays, mondayOf,
} from '../src/trends';

describe('day helpers', () => {
  it('addDays crosses month/year and DST boundaries by whole days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-09', -2)).toBe('2026-03-07'); // US spring-forward weekend
    expect(addDays('2026-08-01', -13)).toBe('2026-07-19');
  });

  it('mondayOf finds the ISO week start (Monday), including on a Monday/Sunday', () => {
    expect(mondayOf('2026-08-01')).toBe('2026-07-27'); // Sat → prior Mon
    expect(mondayOf('2026-07-27')).toBe('2026-07-27'); // Mon → itself
    expect(mondayOf('2026-08-02')).toBe('2026-07-27'); // Sun → same week's Mon
  });
});

describe('smoothWeights (spec 0009)', () => {
  it('single point: trend equals the point (no fabricated neighbors)', () => {
    expect(smoothWeights([{ day: '2026-08-01', kg: 70 }])).toEqual([
      { day: '2026-08-01', kg: 70, trendKg: 70 },
    ]);
  });

  it('averages only real neighbors inside the window', () => {
    const pts = [
      { day: '2026-08-01', kg: 70 },
      { day: '2026-08-02', kg: 71 },
      { day: '2026-08-03', kg: 69 },
    ];
    const sm = smoothWeights(pts, 7);
    expect(sm[1]!.trendKg).toBe(70);       // (70+71+69)/3
    expect(sm[0]!.trendKg).toBe(70);       // window half=3 covers all three
  });

  it('sorts unordered input by day', () => {
    const sm = smoothWeights([
      { day: '2026-08-03', kg: 69 },
      { day: '2026-08-01', kg: 70 },
    ]);
    expect(sm[0]!.day).toBe('2026-08-01');
  });
});

describe('weeklySlopeKgPerWeek — honest nulls', () => {
  it('null for <2 points and for spans under 7 days', () => {
    expect(weeklySlopeKgPerWeek([])).toBeNull();
    expect(weeklySlopeKgPerWeek([{ day: '2026-08-01', kg: 70 }])).toBeNull();
    expect(weeklySlopeKgPerWeek([
      { day: '2026-08-01', kg: 70 }, { day: '2026-08-05', kg: 69 },
    ])).toBeNull(); // 4-day span — refuse to extrapolate
  });

  it('recovers a clean linear loss', () => {
    // exactly −0.1 kg/day = −0.7 kg/week over 15 days
    const pts = Array.from({ length: 15 }, (_, i) => ({
      day: addDays('2026-07-18', i), kg: 72 - 0.1 * i,
    }));
    expect(weeklySlopeKgPerWeek(pts)).toBeCloseTo(-0.7, 2);
  });
});

describe('dailyTotals', () => {
  it('returns exactly n buckets ending today, zeros for silent days', () => {
    const out = dailyTotals([{ day: '2026-08-01', value: 500 }], 3, '2026-08-01');
    expect(out.map((d) => d.day)).toEqual(['2026-07-30', '2026-07-31', '2026-08-01']);
    expect(out.map((d) => d.value)).toEqual([0, 0, 500]);
  });

  it('sums multiple entries in one day and ignores out-of-range days', () => {
    const out = dailyTotals([
      { day: '2026-08-01', value: 300 }, { day: '2026-08-01', value: 200.5 },
      { day: '2020-01-01', value: 999 },
    ], 2, '2026-08-01');
    expect(out[1]!.value).toBe(500.5);
  });
});

describe('proteinDaysByWeek', () => {
  it('buckets hit-days into ISO weeks, oldest first', () => {
    const days = [
      { day: '2026-07-27', value: 140 },  // Mon this week — hit
      { day: '2026-07-28', value: 100 },  // logged, not hit
      { day: '2026-07-20', value: 150 },  // prior week — hit
    ];
    const w = proteinDaysByWeek(days, 136, 2, '2026-08-01');
    expect(w.map((b) => b.weekStart)).toEqual(['2026-07-20', '2026-07-27']);
    expect(w[0]!.hitDays).toBe(1);
    expect(w[1]!.hitDays).toBe(1);
    expect(w[1]!.loggedDays).toBe(2);
  });

  it('zero target never divides/hits; zero-value days are not "logged"', () => {
    const w = proteinDaysByWeek([{ day: '2026-07-27', value: 0 }], 0, 1, '2026-08-01');
    expect(w[0]!.hitDays).toBe(0);
    expect(w[0]!.loggedDays).toBe(0);
  });
});

describe('loggedPercent', () => {
  it('counts distinct in-range days over the span including both ends', () => {
    expect(loggedPercent(['2026-08-01'], '2026-08-01', '2026-08-01')).toBe(100);
    expect(loggedPercent(['2026-07-31', '2026-07-31'], '2026-07-30', '2026-08-01')).toBe(33);
    expect(loggedPercent([], '2026-07-30', '2026-08-01')).toBe(0);
  });

  it('ignores days outside the membership span and garbage strings', () => {
    expect(loggedPercent(['2020-01-01', 'garbage', '2026-08-01'], '2026-07-31', '2026-08-01')).toBe(50);
  });
});
