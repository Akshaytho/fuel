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
}

/**
 * Real streak from real logged days. `days` may contain duplicates and any
 * order; only distinct valid day strings count.
 */
export function computeStreak(days: readonly string[], todayISO: string): Streak {
  const distinct = [...new Set(days.filter((d) => !Number.isNaN(toUTCms(d))))]
    .sort((a, b) => toUTCms(a) - toUTCms(b));
  if (distinct.length === 0) return { current: 0, longest: 0, isLongest: false, loggedToday: false };

  // longest run anywhere
  let longest = 1, run = 1;
  for (let i = 1; i < distinct.length; i += 1) {
    run = daysBetween(distinct[i - 1]!, distinct[i]!) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const last = distinct[distinct.length - 1]!;
  const gap = daysBetween(last, todayISO);
  const loggedToday = gap === 0;
  // A run that ended more than one day ago is broken.
  let current = 0;
  if (gap === 0 || gap === 1) {
    current = 1;
    for (let i = distinct.length - 1; i > 0; i -= 1) {
      if (daysBetween(distinct[i - 1]!, distinct[i]!) === 1) current += 1;
      else break;
    }
  }
  return { current, longest, isLongest: current > 0 && current >= longest, loggedToday };
}
