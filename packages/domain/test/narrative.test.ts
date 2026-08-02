import { describe, it, expect } from 'vitest';
import {
  weekAtAGlance, dayNote, comebackNote, celebrationFor, isOnTarget,
  ON_TARGET_HIGH, type DayTotal,
} from '../src/narrative';
import { summarizeConsumed } from '../src/day';
import { computeStreak } from '../src/streak';
import type { Targets, Macros } from '../src/types';

const T: Targets = { kcal: 1547, protein_g: 134, carbs_g: 145, fat_g: 52, clamped: false };
const macros = (kcal: number, protein_g: number): Macros => ({ kcal, protein_g, carbs_g: 0, fat_g: 0 });
const sum = (kcal: number, protein: number, entries = 3) => summarizeConsumed(macros(kcal, protein), entries, T);
const week = (totals: DayTotal[], today: string) => weekAtAGlance(totals, today, T.kcal);

// 2026-09-07 is a Monday; the five-day simulation lived 09-07 … 09-11.
const D = (n: number) => `2026-09-${String(7 + n).padStart(2, '0')}`;

describe('weekAtAGlance', () => {
  it('is Monday-first and marks past/today/future correctly', () => {
    const w = week([{ day: D(0), kcal: 914 }, { day: D(1), kcal: 914 }], D(2));
    expect(w.slots.map((s) => s.letter)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(w.slots.map((s) => s.state)).toEqual(
      ['logged', 'logged', 'today', 'future', 'future', 'future', 'future']);
    expect(w.loggedDays).toBe(2);
    expect(w.elapsedDays).toBe(3);
    expect(w.summary).toBe('2 of 3 days logged this week');
  });

  it('marks a skipped past day as missed, not future', () => {
    const w = week([{ day: D(0), kcal: 900 }], D(3));   // Tue+Wed skipped
    expect(w.slots.slice(0, 4).map((s) => s.state)).toEqual(['logged', 'missed', 'missed', 'today']);
  });

  it('averages only the days that were logged', () => {
    const w = week([{ day: D(0), kcal: 1000 }, { day: D(2), kcal: 2000 }], D(3));
    expect(w.avgKcal).toBe(1500);          // not 1000 (÷ 3 elapsed)
  });

  it('sums multiple totals landing on the same day', () => {
    const w = week([{ day: D(0), kcal: 500 }, { day: D(0), kcal: 600 }], D(0));
    expect(w.slots[0]!.kcal).toBe(1100);
  });

  it('reports nothing logged without dividing by zero', () => {
    const w = week([], D(2));
    expect(w.avgKcal).toBeNull();
    expect(w.summary).toBe('No days logged yet this week');
  });

  it('ignores days outside the current week', () => {
    const w = week([{ day: '2026-08-31', kcal: 2000 }, { day: D(0), kcal: 900 }], D(1));
    expect(w.loggedDays).toBe(1);
    expect(w.avgKcal).toBe(900);
  });

  it('Sunday is the LAST slot, not the first (a Sunday user sees a full week)', () => {
    const w = week([{ day: '2026-09-13', kcal: 1500 }], '2026-09-13'); // Sunday
    expect(w.slots[6]!.state).toBe('logged');
    expect(w.elapsedDays).toBe(7);
  });

  // rule 0c — two-year life review
  it('survives DST both ways, year rollover, ISO week 53 and leap day', () => {
    for (const today of ['2026-03-08', '2026-11-01', '2026-12-31', '2027-01-01', '2020-12-31', '2024-02-29']) {
      const w = week([{ day: today, kcal: 1500 }], today);
      expect(w.slots).toHaveLength(7);
      expect(w.slots.filter((s) => s.state === 'logged')).toHaveLength(1);
      expect(new Set(w.slots.map((s) => s.day)).size).toBe(7);
    }
  });

  it('handles two years of daily totals quickly', () => {
    const totals: DayTotal[] = [];
    const start = Date.UTC(2024, 0, 1);
    for (let i = 0; i < 730; i += 1) {
      totals.push({ day: new Date(start + i * 86400000).toISOString().slice(0, 10), kcal: 1400 + (i % 400) });
    }
    const t0 = Date.now();
    const w = week(totals, '2025-06-18');
    expect(Date.now() - t0).toBeLessThan(50);
    expect(w.loggedDays).toBe(7);
  });

  it('on-target is a band, so under-eating is not scored as a win', () => {
    expect(isOnTarget(1547, 1547)).toBe(true);
    expect(isOnTarget(1400, 1547)).toBe(true);          // 90%
    expect(isOnTarget(900, 1547)).toBe(false);          // 58% — not a win
    expect(isOnTarget(1700, 1547)).toBe(false);         // 110% — over
    expect(isOnTarget(0, 1547)).toBe(false);
    expect(isOnTarget(1500, 0)).toBe(false);            // degenerate target
  });
});

describe('dayNote — the line that said "Nice" on a blowout', () => {
  it("does NOT congratulate a day that is 2,067 kcal over (Sam, day 3)", () => {
    const note = dayNote({
      summary: sum(3614, 141),
      targets: T,
      week: week([{ day: D(0), kcal: 914 }, { day: D(1), kcal: 914 }, { day: D(2), kcal: 3614 }], D(2)),
    })!;
    expect(note.tone).toBe('perspective');
    expect(note.text).not.toMatch(/Nice/);
    expect(note.text).not.toMatch(/protein to go/);
    expect(note.text).toContain('2,067 over today');
  });

  it('gives the honest week arithmetic when the week is still under target', () => {
    const note = dayNote({
      summary: sum(3614, 141),
      targets: T,
      week: week([{ day: D(0), kcal: 914 }, { day: D(1), kcal: 914 }, { day: D(2), kcal: 3614 }], D(2)),
    })!;
    // (914 + 914 + 3614) / 3 = 1814 — that is NOT under 1547, so it must not claim it is.
    expect(note.text).not.toContain('still under');
    expect(note.text).toContain('one of 3 days');
  });

  it('uses the week average only when the average really is under target', () => {
    const totals = [D(0), D(1), D(2), D(3)].map((day, i) => ({ day, kcal: i === 3 ? 1900 : 1000 }));
    const note = dayNote({ summary: sum(1900, 100), targets: T, week: week(totals, D(3)) })!;
    expect(note.tone).toBe('perspective');
    expect(note.text).toContain('this week averages 1,225');
    expect(note.text).toContain("One day doesn't undo a week");
  });

  it('falls back to a clean-sheet line on a lone over-target day', () => {
    const note = dayNote({ summary: sum(2500, 100), targets: T, week: week([{ day: D(0), kcal: 2500 }], D(0)) })!;
    expect(note.text).toBe("953 over today. One day doesn't undo anything — tomorrow starts clean.");
  });

  it('treats a 3% overshoot as rounding, not a blowout', () => {
    const note = dayNote({ summary: sum(1590, 140), targets: T, week: week([{ day: D(0), kcal: 1590 }], D(0)) })!;
    expect(note.tone).toBe('good');
  });

  it('celebrates protein in words when the day is on target (Ravi, day 5)', () => {
    const note = dayNote({ summary: sum(1530, 140), targets: T, week: week([{ day: D(4), kcal: 1530 }], D(4)) })!;
    expect(note.tone).toBe('good');
    expect(note.text).toContain('Protein target hit');
  });

  it('is silent on an empty day (no strip at all)', () => {
    expect(dayNote({ summary: sum(0, 0, 0), targets: T, week: week([], D(0)) })).toBeNull();
  });

  it('still counts down protein on a normal mid-day', () => {
    const note = dayNote({ summary: sum(600, 39), targets: T, week: week([{ day: D(0), kcal: 600 }], D(0)) })!;
    expect(note.tone).toBe('neutral');
    expect(note.text).toBe('95 g protein to go.');
  });
});

describe('comebackNote — the app must not forget you', () => {
  it('greets a returning user and remembers their best run (Ravi, day 5)', () => {
    const days = [D(0), D(1), D(2)];                     // then day 4 missed
    const c = comebackNote(days, D(4), computeStreak(days, D(4)))!;
    expect(c.daysAway).toBe(1);
    expect(c.bestStreak).toBe(3);
    expect(c.title).toBe('Welcome back — a day off');
    expect(c.body).toContain('Your best run is 3 days');
  });

  it('does NOT fire on a normal morning (yesterday logged, today not yet)', () => {
    const days = [D(0), D(1)];
    expect(comebackNote(days, D(2), computeStreak(days, D(2)))).toBeNull();
  });

  it('does NOT fire for a brand-new user with no history', () => {
    expect(comebackNote([], D(0), computeStreak([], D(0)))).toBeNull();
  });

  it('handles a two-year absence without inventing a streak to brag about', () => {
    const days = ['2024-06-01'];
    const c = comebackNote(days, '2026-06-01', computeStreak(days, '2026-06-01'))!;
    expect(c.daysAway).toBe(729);
    expect(c.body).toContain('Nothing to make up for');
  });

  it('pluralises days off correctly', () => {
    const days = [D(0)];
    expect(comebackNote(days, D(3), computeStreak(days, D(3)))!.title).toBe('Welcome back — 2 days off');
  });
});

describe('celebrationFor — design 6a', () => {
  const streakAt = (days: string[], today: string) => computeStreak(days, today);

  it('fires when protein lands and calories are on target', () => {
    const c = celebrationFor({ summary: sum(1530, 140), targets: T, streak: streakAt([D(4)], D(4)) })!;
    expect(c.kind).toBe('both');
    expect(c.title).toBe('Target hit');
    expect(c.streakLine).toBe('Streak: 1 → 2 at midnight');
  });

  it('NEVER fires on an over-target day, even with protein hit', () => {
    expect(celebrationFor({ summary: sum(3614, 141), targets: T, streak: streakAt([D(2)], D(2)) })).toBeNull();
  });

  it('does not fire on a single snack', () => {
    expect(celebrationFor({ summary: sum(1500, 140, 1), targets: T, streak: streakAt([D(0)], D(0)) })).toBeNull();
  });

  it('does not fire on a barely-eaten day that happens to be under target', () => {
    expect(celebrationFor({ summary: sum(300, 20), targets: T, streak: streakAt([D(0)], D(0)) })).toBeNull();
  });

  it('names the run only once there IS a run', () => {
    const solo = celebrationFor({ summary: sum(1530, 140), targets: T, streak: streakAt([D(4)], D(4)) })!;
    expect(solo.body[0]).toBe('140 g protein down.');
    const run = celebrationFor({
      summary: sum(1530, 140), targets: T, streak: streakAt([D(0), D(1), D(2), D(3), D(4)], D(4)),
    })!;
    expect(run.body[0]).toBe('140 g protein down, 5 days in a row.');
    expect(run.streakLine).toBe('Streak: 5 → 6 at midnight');
  });

  it('offers the remaining budget when there is one, otherwise says it landed', () => {
    const early = celebrationFor({ summary: sum(1200, 140), targets: T, streak: streakAt([D(4)], D(4)) })!;
    expect(early.body[1]).toBe('347 calories still in the bank — coast from here.');
    const exact = celebrationFor({ summary: sum(1540, 140), targets: T, streak: streakAt([D(4)], D(4)) })!;
    expect(exact.body[1]).toBe('The day landed right on the number.');
  });

  it('distinguishes calories-only from protein-only', () => {
    expect(celebrationFor({ summary: sum(1500, 60), targets: T, streak: streakAt([D(4)], D(4)), hourOfDay: 21 })!.kind).toBe('calories');
    expect(celebrationFor({ summary: sum(1000, 140), targets: T, streak: streakAt([D(4)], D(4)), hourOfDay: 13 })!.kind).toBe('protein');
  });

  it('does NOT call a mid-afternoon 88% day "on target" — dinner is still ahead', () => {
    // 1,370 of 1,547 at 14:00 is inside the band but the day is not over.
    // "Coast from here" would be bad advice, so nothing fires.
    expect(celebrationFor({ summary: sum(1370, 60), targets: T, streak: streakAt([D(4)], D(4)), hourOfDay: 14 })).toBeNull();
    expect(celebrationFor({ summary: sum(1370, 60), targets: T, streak: streakAt([D(4)], D(4)), hourOfDay: 20 })).not.toBeNull();
  });

  it('celebrates a protein win at any hour — it cannot be un-hit', () => {
    expect(celebrationFor({ summary: sum(900, 140), targets: T, streak: streakAt([D(4)], D(4)), hourOfDay: 9 })!.kind).toBe('protein');
  });

  it('is safe at the exact band edge and with degenerate targets', () => {
    const edge = Math.round(T.kcal * ON_TARGET_HIGH);
    expect(celebrationFor({ summary: sum(edge + 5, 140), targets: T, streak: streakAt([D(4)], D(4)) })).toBeNull();
    const zero: Targets = { ...T, kcal: 0, protein_g: 0 };
    expect(celebrationFor({ summary: summarizeConsumed(macros(0, 0), 3, zero), targets: zero, streak: streakAt([], D(4)) })).toBeNull();
  });
});

describe('week strip honours spec 0012 (a half-logged day is not a logged day)', () => {
  it('marks a past day below half target as partial, not logged', () => {
    const w = week([{ day: D(0), kcal: 1500 }, { day: D(1), kcal: 200 }], D(2));
    expect(w.slots[0]!.state).toBe('logged');
    expect(w.slots[1]!.state).toBe('partial');
    expect(w.loggedDays).toBe(1);
    expect(w.partialDays).toBe(1);
    expect(w.summary).toBe('1 of 3 days logged this week');
  });

  it('never flags TODAY as partial — a day in progress is meant to be incomplete', () => {
    const w = week([{ day: D(2), kcal: 200 }], D(2));   // breakfast at 9am
    expect(w.slots[2]!.state).toBe('logged');
    expect(w.partialDays).toBe(0);
  });

  it('leaves partial days out of the week average, exactly like the report', () => {
    const w = week([{ day: D(0), kcal: 1600 }, { day: D(1), kcal: 100 }], D(3));
    expect(w.avgKcal).toBe(1600);       // not 850
  });
});
