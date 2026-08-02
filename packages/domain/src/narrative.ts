/**
 * NARRATIVE — what the app SAYS to a person about their day.
 *
 * Written after the five-day/five-persona simulation (docs/qa/0002), where the
 * app's voice failed three real humans:
 *
 *   Day 3  Sam ate 2,067 kcal over target and the screen said "Nice — 0 g
 *          protein to go." Cheerful, technically true, and tone-deaf. A person
 *          who has just blown a day needs PERSPECTIVE (the week is still fine),
 *          not applause and not a scolding.
 *   Day 5  Ravi landed his protein target dead on and the app said nothing.
 *          The one moment worth celebrating passed in silence.
 *   Day 5  Ravi came back after a missed day and got the copy a brand-new user
 *          gets — "Log your first meal" — with his 3-day run erased and
 *          unmentioned. The app forgot him.
 *
 * Everything here is pure: strings in, strings out, no clock, no IO, no React.
 * The tone rules are the product decision; they belong in one tested place
 * rather than scattered across screens as inline ternaries (which is exactly
 * how the "Nice —" bug shipped).
 */
import { DaySummary, Targets } from './types';
import { Streak, daysBetween } from './streak';
import { classifyDay } from './report';
import { OVER_TOLERANCE } from './day';

/** One day's logged energy, as stored. */
export interface DayTotal { day: string; kcal: number }

// ---------------------------------------------------------------------------
// Week at a glance
// ---------------------------------------------------------------------------

export type WeekDayState =
  | 'future'   // hasn't happened yet this week
  | 'today'    // today, nothing logged yet
  | 'logged'   // recorded in full
  | 'partial'  // has logs, but too few to be a recorded day (spec 0012)
  | 'rested'   // not logged, but an earned rest day covered it (spec 0013)
  | 'missed';  // past day of this week with no logs

export interface WeekSlot {
  day: string;          // YYYY-MM-DD
  letter: string;       // M T W T F S S
  state: WeekDayState;
  kcal: number;
  /** within the on-target band (see ON_TARGET_LOW/HIGH) */
  onTarget: boolean;
}

export interface WeekGlance {
  /** exactly 7, in week order */
  slots: WeekSlot[];
  loggedDays: number;
  onTargetDays: number;
  /** days of this week that have already happened (incl. today) */
  elapsedDays: number;
  /** mean kcal across LOGGED days only; null when nothing is logged */
  avgKcal: number | null;
  /** days with some logs but too few to count as recorded (spec 0012) */
  partialDays: number;
  /** days in this week covered by an earned rest day (spec 0013) */
  restedDays: number;
  /** the plain answer to "how am I doing this week" */
  summary: string;
}

/**
 * "On target" is a BAND, not a bullseye. Under-eating by a third is not a win
 * and pretending otherwise teaches restriction; going 5% over on a 1,500 kcal
 * target is 75 kcal and is not a failure. Both edges are deliberate.
 */
export const ON_TARGET_LOW = 0.85;
export const ON_TARGET_HIGH = 1.05;

export function isOnTarget(kcal: number, targetKcal: number): boolean {
  if (targetKcal <= 0 || kcal <= 0) return false;
  return kcal >= targetKcal * ON_TARGET_LOW && kcal <= targetKcal * ON_TARGET_HIGH;
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function shiftDay(dayISO: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) return dayISO;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0=Mon … 6=Sun for a local-day string (UTC-parts arithmetic: DST-proof). */
function mondayIndex(dayISO: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) return 0;
  return (new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() + 6) % 7;
}

/**
 * The current Monday–Sunday week, one slot per day.
 * `totals` may contain any days in any order; only this week's are used.
 */
export function weekAtAGlance(
  totals: readonly DayTotal[],
  todayISO: string,
  targetKcal: number,
  /** days an earned rest day is covering (spec 0013) — drawn distinctly, so
      the strip never presents a covered day as a logged one */
  restedDays: readonly string[] = [],
): WeekGlance {
  const restSet = new Set(restedDays);
  const byDay = new Map<string, number>();
  for (const t of totals) byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.kcal);

  const offset = mondayIndex(todayISO);
  const monday = shiftDay(todayISO, -offset);

  const slots: WeekSlot[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = shiftDay(monday, i);
    const kcal = byDay.get(day) ?? 0;
    // Today is exempt: a day still in progress is SUPPOSED to be incomplete,
    // and flagging breakfast as "half-logged" at 9am would be nonsense.
    const cls = i === offset ? (kcal > 0 ? 'full' : 'none') : classifyDay(kcal, targetKcal);
    const state: WeekDayState = cls === 'full' ? 'logged'
      : cls === 'partial' ? 'partial'
      : restSet.has(day) ? 'rested'
      : i === offset ? 'today'
      : i > offset ? 'future'
      : 'missed';
    slots.push({ day, letter: LETTERS[i]!, state, kcal, onTarget: isOnTarget(kcal, targetKcal) });
  }

  const loggedDays = slots.filter((s) => s.state === 'logged').length;
  const partialDays = slots.filter((s) => s.state === 'partial').length;
  const restedCount = slots.filter((s) => s.state === 'rested').length;
  const onTargetDays = slots.filter((s) => s.onTarget).length;
  const elapsedDays = offset + 1;
  // averages over RECORDED days only, for the same reason the report does
  const loggedKcal = slots.filter((s) => s.state === 'logged').map((s) => s.kcal);
  const avgKcal = loggedKcal.length > 0
    ? Math.round(loggedKcal.reduce((a, b) => a + b, 0) / loggedKcal.length)
    : null;

  const summary = loggedDays === 0
    ? `No days logged yet this week`
    : `${loggedDays} of ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} logged this week`;

  return { slots, loggedDays, partialDays, restedDays: restedCount, onTargetDays, elapsedDays, avgKcal, summary };
}

// ---------------------------------------------------------------------------
// The line under the rings
// ---------------------------------------------------------------------------

export type DayTone = 'neutral' | 'good' | 'perspective';
export interface DayNote { tone: DayTone; text: string }

const n0 = (x: number) => Math.round(x).toLocaleString('en-US');

/**
 * The single line under the rings. Reads the WHOLE day (and the week behind
 * it), never one macro in isolation.
 *
 * Order matters: a day that is 2,000 kcal over is an over-target day no matter
 * how good the protein number looks. That inversion is what produced "Nice —
 * 0 g protein to go" on Sam's blowout.
 */
export function dayNote(args: {
  summary: DaySummary;
  targets: Targets;
  week: WeekGlance;
}): DayNote | null {
  const { summary, targets, week } = args;
  if (summary.entryCount === 0) return null;

  const overBy = summary.consumed.kcal - targets.kcal;
  const meaningfullyOver = targets.kcal > 0 && overBy > targets.kcal * OVER_TOLERANCE;

  if (meaningfullyOver) {
    // Perspective, in this order of preference: the honest arithmetic of the
    // week (best), then the shape of the week, then a clean-sheet reminder.
    // No exclamation marks and no "don't worry" — adults can read a number.
    const avg = week.avgKcal;
    if (week.loggedDays >= 3 && avg !== null && avg <= targets.kcal) {
      return {
        tone: 'perspective',
        text: `${n0(overBy)} over today — but this week averages ${n0(avg)}, still under ${n0(targets.kcal)}. One day doesn't undo a week.`,
      };
    }
    if (week.loggedDays >= 2) {
      return {
        tone: 'perspective',
        text: `${n0(overBy)} over today — one of ${week.loggedDays} days you've logged this week. Tomorrow starts clean.`,
      };
    }
    return {
      tone: 'perspective',
      text: `${n0(overBy)} over today. One day doesn't undo anything — tomorrow starts clean.`,
    };
  }

  const proteinLeft = Math.max(0, summary.remaining.protein_g);
  const kcalLeft = Math.max(0, summary.remaining.kcal);

  if (proteinLeft <= 0) {
    return kcalLeft > 0
      ? { tone: 'good', text: `Protein target hit — ${n0(summary.consumed.protein_g)} g, with ${n0(kcalLeft)} calories still to spend.` }
      : { tone: 'good', text: `Protein target hit — ${n0(summary.consumed.protein_g)} g, and the day landed on target.` };
  }

  return { tone: 'neutral', text: `${n0(proteinLeft)} g protein to go.` };
}

// ---------------------------------------------------------------------------
// Coming back after a gap
// ---------------------------------------------------------------------------

export interface Comeback {
  daysAway: number;
  bestStreak: number;
  title: string;
  body: string;
}

/** A gap this long or longer is worth naming out loud. */
export const COMEBACK_MIN_GAP_DAYS = 2;

/**
 * A user with history who has been away. Returns null for brand-new users and
 * for users whose streak is merely un-extended (yesterday logged, today not) —
 * that is a normal morning, not a comeback.
 */
export function comebackNote(
  loggedDays: readonly string[],
  todayISO: string,
  streak: Streak,
): Comeback | null {
  const distinct = [...new Set(loggedDays)].sort();
  const last = distinct[distinct.length - 1];
  if (last === undefined) return null;
  const gap = daysBetween(last, todayISO);
  if (!Number.isFinite(gap) || gap < COMEBACK_MIN_GAP_DAYS) return null;

  const away = gap - 1;                    // full days with nothing logged
  const best = Math.max(streak.longest, 0);
  const awayLabel = away === 1 ? 'a day' : `${away} days`;
  return {
    daysAway: away,
    bestStreak: best,
    title: `Welcome back — ${awayLabel} off`,
    body: best >= 2
      ? `Your best run is ${best} days. Log anything today and you're going again.`
      : `Nothing to make up for. Log anything today and you're going again.`,
  };
}

// ---------------------------------------------------------------------------
// The celebration (design 6a)
// ---------------------------------------------------------------------------

export type CelebrationKind = 'protein' | 'calories' | 'both';

export interface Celebration {
  kind: CelebrationKind;
  title: string;
  /** two short lines, rendered stacked */
  body: string[];
  /** the flame pill; omitted when there is no streak to speak of */
  streakLine?: string;
}

/** A single yoghurt should not trigger fireworks. */
export const CELEBRATION_MIN_ENTRIES = 2;

/**
 * Local hour from which "calories landed on target" is a RESULT rather than a
 * halfway point. Before this, a person at 88% of their budget still has dinner
 * ahead; telling them to "coast from here" would be actively bad advice.
 * Protein is different — hitting it cannot be undone by eating more, so a
 * protein win is celebrated whenever it happens.
 */
export const CELEBRATION_EVENING_HOUR = 20;

/**
 * The moment worth interrupting for (design 6a): the day LANDED. Deliberately
 * strict — a celebration that fires most days is wallpaper, and one that fires
 * on an over-target day is a lie.
 */
export function celebrationFor(args: {
  summary: DaySummary;
  targets: Targets;
  streak: Streak;
  /** local hour 0–23; omit only in tests that are exercising protein wins */
  hourOfDay?: number;
}): Celebration | null {
  const { summary, targets, streak } = args;
  const hour = args.hourOfDay ?? CELEBRATION_EVENING_HOUR;
  if (summary.entryCount < CELEBRATION_MIN_ENTRIES) return null;
  if (targets.kcal <= 0) return null;
  // Never celebrate over target — not even "you hit protein!". The day is over
  // target; that is the fact on the screen and the app must not contradict it.
  if (summary.consumed.kcal > targets.kcal * ON_TARGET_HIGH) return null;

  const proteinHit = targets.protein_g > 0 && summary.consumed.protein_g >= targets.protein_g;
  const caloriesLanded = isOnTarget(summary.consumed.kcal, targets.kcal)
    && hour >= CELEBRATION_EVENING_HOUR;
  if (!proteinHit && !caloriesLanded) return null;

  const kind: CelebrationKind = proteinHit && caloriesLanded ? 'both' : proteinHit ? 'protein' : 'calories';
  const title = kind === 'both' ? 'Target hit'
    : kind === 'protein' ? 'Protein target hit'
    : 'Calories on target';

  const runLine = streak.current >= 2
    ? `${n0(summary.consumed.protein_g)} g protein down, ${streak.current} days in a row.`
    : `${n0(summary.consumed.protein_g)} g protein down.`;
  const kcalLeft = targets.kcal - summary.consumed.kcal;
  const secondLine = kcalLeft > 50
    ? `${n0(kcalLeft)} calories still in the bank — coast from here.`
    : `The day landed right on the number.`;

  const out: Celebration = { kind, title, body: [runLine, secondLine] };
  if (streak.loggedToday && streak.current >= 1) {
    out.streakLine = `Streak: ${streak.current} → ${streak.current + 1} at midnight`;
  }
  return out;
}
