/**
 * Streak + day-number math over LOCAL calendar day strings (YYYY-MM-DD).
 *
 * Pure and platform-free. Day strings are compared by UTC-parsing their parts,
 * which is safe precisely BECAUSE they are already local-day strings produced
 * by localDayISO() — we only ever do date arithmetic on them, never re-derive
 * a local day from an instant (that was P0-B).
 */

const DAY_MS = 86_400_000;

function toUTCms(dayISO: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days from `from` to `to` (negative if `to` precedes `from`). */
export function daysBetween(fromDayISO: string, toDayISO: string): number {
  const a = toUTCms(fromDayISO), b = toUTCms(toDayISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / DAY_MS);
}

/** 1-based day number since start (start day itself is Day 1). */
export function dayNumber(startDayISO: string, todayISO: string): number {
  const d = daysBetween(startDayISO, todayISO);
  return Number.isNaN(d) ? 1 : Math.max(1, d + 1);
}

/**
 * Rest days (spec 0013). Logging this many consecutive days earns one.
 * The churn literature's dominant abandonment cascade is "missed a day →
 * the summary is wrong → logging feels pointless → gone", and only 23% of
 * people who quit a food tracker did so because they reached their goal.
 * A streak that shatters on one sick day is that cascade's trigger.
 */
export const REST_DAY_EARN_DAYS = 7;
export const REST_DAY_MAX_BANKED = 2;

export interface Streak {
  /** Consecutive logged days ending today, or ending yesterday if today is
      not logged yet (the streak is alive but not yet extended). 0 if broken. */
  current: number;
  /** Longest consecutive run anywhere in the history. */
  longest: number;
  /** true when the current run IS the longest (and non-zero) — worth celebrating. */
  isLongest: boolean;
  /** true when today itself has been logged. */
  loggedToday: boolean;
  /** earned-and-unspent rest days, 0…REST_DAY_MAX_BANKED */
  restDaysAvailable: number;
  /** days inside the CURRENT run that a rest day is covering. Never presented
      as logged days — the app shows them as rest days or not at all. */
  restedDays: string[];
}

/**
 * Real streak from real logged days. `days` may contain duplicates and any
 * order; only distinct valid day strings count.
 */
export function computeStreak(days: readonly string[], todayISO: string): Streak {
  const distinct = [...new Set(days.filter((d) => !Number.isNaN(toUTCms(d))))]
    .sort((a, b) => toUTCms(a) - toUTCms(b));
  if (distinct.length === 0) {
    return {
      current: 0, longest: 0, isLongest: false, loggedToday: false,
      restDaysAvailable: 0, restedDays: [],
    };
  }

  /*
   * One forward pass does all of it. Rest days are DERIVED from the logged-day
   * list rather than stored, so they survive sign-out, a device change and a
   * server restore, and there is no state that can drift out of sync.
   *
   * The invariant that matters: `run` counts days actually LOGGED. A rest day
   * bridges a gap so the run continues; it never becomes a logged day. See
   * spec 0013 — an app that rewrites a missed day as a logged one has lied to
   * the person about their own life.
   */
  let banked = 0;
  let earnedAt = 0;          // run length at which the last rest day was earned
  let run = 1;
  let longest = 1;
  let rested: string[] = [];

  const earn = () => {
    if (run - earnedAt >= REST_DAY_EARN_DAYS) {
      earnedAt = run;
      banked = Math.min(REST_DAY_MAX_BANKED, banked + 1);
    }
  };
  const breakRun = () => { run = 1; earnedAt = 0; rested = []; };  // banked is KEPT

  earn();
  for (let i = 1; i < distinct.length; i += 1) {
    const gap = daysBetween(distinct[i - 1]!, distinct[i]!);
    if (gap === 1) {
      run += 1;
    } else if (gap === 2 && banked > 0) {
      banked -= 1;
      rested = [...rested, addOneDay(distinct[i - 1]!)];
      run += 1;                                   // the logged day, not the gap
    } else {
      breakRun();
    }
    earn();
    if (run > longest) longest = run;
  }

  const last = distinct[distinct.length - 1]!;
  const tailGap = daysBetween(last, todayISO);
  const loggedToday = tailGap === 0;

  let current = run;
  let restDaysAvailable = banked;
  let restedDays = rested;
  if (tailGap === 0 || tailGap === 1) {
    // alive: today is logged, or yesterday was and today is still young
  } else if (tailGap === 2 && banked > 0) {
    // one day missed and a rest day covers it — the run is alive but unspent
    // until they log today, so we show the cover without deducting twice
    restDaysAvailable = banked - 1;
    restedDays = [...rested, addOneDay(last)];
  } else {
    current = 0;
    restedDays = [];
  }

  return {
    current, longest, isLongest: current > 0 && current >= longest, loggedToday,
    restDaysAvailable, restedDays,
  };
}

function addOneDay(dayISO: string): string {
  const d = new Date(toUTCms(dayISO) + DAY_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
