import { describe, it, expect } from 'vitest';
import { computeStreak, REST_DAY_EARN_DAYS, REST_DAY_MAX_BANKED } from '../src/streak';

/** Spec 0013. A streak that shatters on one sick day is the trigger for the
    dominant abandonment cascade in the churn literature. */

const D = (n: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => D(from + i));

describe('earning rest days', () => {
  it('earns nothing before the seventh consecutive day', () => {
    const s = computeStreak(range(0, 5), D(5));
    expect(s.current).toBe(6);
    expect(s.restDaysAvailable).toBe(0);
  });

  it('earns one at seven days', () => {
    const s = computeStreak(range(0, 6), D(6));
    expect(s.current).toBe(7);
    expect(s.restDaysAvailable).toBe(1);
  });

  it('earns a second at fourteen', () => {
    expect(computeStreak(range(0, 13), D(13)).restDaysAvailable).toBe(2);
  });

  it('never banks more than the cap, however long the run', () => {
    for (const days of [21, 60, 400]) {
      expect(computeStreak(range(0, days), D(days)).restDaysAvailable).toBe(REST_DAY_MAX_BANKED);
    }
  });
});

describe('spending a rest day', () => {
  it('one missed day after a 7-day run does NOT reset the streak', () => {
    // logged 0..6, missed day 7, logged day 8
    const s = computeStreak([...range(0, 6), D(8)], D(8));
    expect(s.current).toBe(8);            // 8 days LOGGED, across 9 calendar days
    expect(s.restDaysAvailable).toBe(0);  // spent
    expect(s.restedDays).toEqual([D(7)]);
  });

  it('the rested day is never counted as a logged day', () => {
    const s = computeStreak([...range(0, 6), D(8)], D(8));
    // 8 logged days is the truth: 0,1,2,3,4,5,6,8. Day 7 is covered, not logged.
    expect(s.current).toBe(8);
    expect(s.restedDays).not.toContain(D(8));
  });

  it('a two-day gap breaks the run even with a rest day banked', () => {
    const s = computeStreak([...range(0, 6), D(9)], D(9));
    expect(s.current).toBe(1);
    expect(s.restDaysAvailable).toBe(1);   // earned days are KEPT, not confiscated
    expect(s.restedDays).toEqual([]);
  });

  it('a second miss with nothing banked breaks it', () => {
    // 7-day run, miss, log, miss, log — the second gap has no cover
    const s = computeStreak([...range(0, 6), D(8), D(10)], D(10));
    expect(s.current).toBe(1);
    expect(s.restDaysAvailable).toBe(0);
  });

  it('two banked rest days cover two separate single misses', () => {
    const s = computeStreak([...range(0, 13), D(15), D(17)], D(17));
    expect(s.current).toBe(16);
    expect(s.restDaysAvailable).toBe(0);
    expect(s.restedDays).toEqual([D(14), D(16)]);
  });

  it('a miss with nothing banked breaks it, exactly as before', () => {
    const s = computeStreak([...range(0, 3), D(5)], D(5));
    expect(s.current).toBe(1);
    expect(s.restDaysAvailable).toBe(0);
  });
});

describe('what "today" means', () => {
  it('an ordinary morning is not a miss — yesterday logged, today not yet', () => {
    const s = computeStreak(range(0, 6), D(7));
    expect(s.current).toBe(7);
    expect(s.loggedToday).toBe(false);
    expect(s.restDaysAvailable).toBe(1);       // not spent — nothing was missed
    expect(s.restedDays).toEqual([]);
  });

  it('one day missed and today still unlogged: the run is alive, covered', () => {
    const s = computeStreak(range(0, 6), D(8));
    expect(s.current).toBe(7);
    expect(s.restDaysAvailable).toBe(0);
    expect(s.restedDays).toEqual([D(7)]);
  });

  it('one day missed with nothing banked: broken, and honestly so', () => {
    const s = computeStreak(range(0, 3), D(5));
    expect(s.current).toBe(0);
    expect(s.restedDays).toEqual([]);
  });

  it('two days missed: broken even with a rest day banked', () => {
    const s = computeStreak(range(0, 6), D(9));
    expect(s.current).toBe(0);
    expect(s.restDaysAvailable).toBe(1);
  });
});

describe('rule 0c — a rest day must hold up over two years', () => {
  it('handles 730 daily logs inside the perf budget and never over-banks', () => {
    const days = range(0, 729);
    const t0 = Date.now();
    const s = computeStreak(days, D(729));
    expect(Date.now() - t0).toBeLessThan(60);
    expect(s.current).toBe(730);
    expect(s.restDaysAvailable).toBe(REST_DAY_MAX_BANKED);
  });

  it('a realistic two years — logs most days, misses one here and there', () => {
    const days: string[] = [];
    for (let i = 0; i < 730; i += 1) if (i % 23 !== 0) days.push(D(i));
    const s = computeStreak(days, D(729));
    // 22 clean days re-earns a rest day before the next miss lands, so the run
    // genuinely never breaks: 698 days logged with 31 covered gaps.
    expect(s.current).toBe(698);
    expect(s.restedDays).toHaveLength(31);
    expect(s.restDaysAvailable).toBeLessThanOrEqual(REST_DAY_MAX_BANKED);
    // THE HONESTY INVARIANT: a covered day is never also a logged day, so the
    // UI can always show "698 days · 31 rest days" and both numbers are true.
    const logged = new Set(days);
    for (const r of s.restedDays) expect(logged.has(r)).toBe(false);
    expect(s.current + s.restedDays.length).toBe(729);
  });

  it('never reports more logged days than were actually logged', () => {
    // The single failure mode that would make rest days dishonest.
    for (const step of [3, 5, 8, 12, 23]) {
      const days: string[] = [];
      for (let i = 0; i < 200; i += 1) if (i % step !== 0) days.push(D(i));
      const s = computeStreak(days, D(199));
      expect(s.current).toBeLessThanOrEqual(days.length);
      expect(s.longest).toBeLessThanOrEqual(days.length);
    }
  });

  it('survives DST both ways and a leap day without losing a run', () => {
    // US spring-forward 2026-03-08 and fall-back 2026-11-01, plus 2024-02-29
    const around = (iso: string) => {
      const base = Date.parse(iso + 'T00:00:00Z');
      return Array.from({ length: 9 }, (_, i) =>
        new Date(base + (i - 4) * 86400000).toISOString().slice(0, 10));
    };
    for (const day of ['2026-03-08', '2026-11-01', '2024-02-29']) {
      const days = around(day);
      const s = computeStreak(days, days[days.length - 1]!);
      expect(s.current).toBe(9);
      expect(s.restDaysAvailable).toBe(1);
    }
  });

  it('is order- and duplicate-proof, like the rest of the streak math', () => {
    const days = [...range(0, 6), D(8)];
    const shuffled = [...days, ...days].reverse();
    expect(computeStreak(shuffled, D(8))).toEqual(computeStreak(days, D(8)));
  });

  it('REST_DAY_EARN_DAYS is the documented 7', () => {
    expect(REST_DAY_EARN_DAYS).toBe(7);
  });
});
