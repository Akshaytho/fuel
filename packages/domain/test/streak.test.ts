import { describe, it, expect } from 'vitest';
import { computeStreak, daysBetween, dayNumber } from '../src/streak';

describe('day arithmetic', () => {
  it('counts whole days across a month boundary', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1); // 2026 is not a leap year
    expect(daysBetween('2026-03-01', '2026-02-28')).toBe(-1);
  });

  it('is DST-proof (the reason we parse as UTC parts)', () => {
    // US spring-forward 2026-03-08 — a naive local-midnight diff gives 0.958 days
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('dayNumber is 1-based from the start day', () => {
    expect(dayNumber('2026-07-28', '2026-07-28')).toBe(1);
    expect(dayNumber('2026-07-28', '2026-07-29')).toBe(2);
    expect(dayNumber('2026-07-28', '2026-08-27')).toBe(31);
  });

  it('never returns less than 1, even on garbage', () => {
    expect(dayNumber('2026-07-28', '2026-07-01')).toBe(1);
    expect(dayNumber('nonsense', '2026-07-01')).toBe(1);
  });
});

describe('computeStreak (B-16: real data, never fabricated)', () => {
  it('no history → zero streak, not "1 day"', () => {
    expect(computeStreak([], '2026-07-28')).toEqual({
      current: 0, longest: 0, isLongest: false, loggedToday: false,
    });
  });

  it('logged only today → 1 day', () => {
    const s = computeStreak(['2026-07-28'], '2026-07-28');
    expect(s.current).toBe(1);
    expect(s.loggedToday).toBe(true);
  });

  it('counts consecutive days ending today', () => {
    const s = computeStreak(['2026-07-26', '2026-07-27', '2026-07-28'], '2026-07-28');
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
    expect(s.isLongest).toBe(true);
  });

  it('duplicates within a day count once', () => {
    const s = computeStreak(['2026-07-28', '2026-07-28', '2026-07-27'], '2026-07-28');
    expect(s.current).toBe(2);
  });

  it('stays alive when yesterday was logged but today has not been yet', () => {
    const s = computeStreak(['2026-07-26', '2026-07-27'], '2026-07-28');
    expect(s.current).toBe(2);
    expect(s.loggedToday).toBe(false);
  });

  it('breaks when the last log is 2+ days ago', () => {
    const s = computeStreak(['2026-07-20', '2026-07-21'], '2026-07-28');
    expect(s.current).toBe(0);
    expect(s.longest).toBe(2);
    expect(s.isLongest).toBe(false);
  });

  it('finds the longest historical run even when the current one is shorter', () => {
    const s = computeStreak(
      ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-27', '2026-07-28'],
      '2026-07-28',
    );
    expect(s.current).toBe(2);
    expect(s.longest).toBe(4);
    expect(s.isLongest).toBe(false);
  });

  it('ignores malformed day strings instead of crashing', () => {
    const s = computeStreak(['', 'yesterday', '2026-07-28'], '2026-07-28');
    expect(s.current).toBe(1);
  });
});
