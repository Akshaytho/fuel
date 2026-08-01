/**
 * Trend math for the Trends screen (spec 0009). Pure, platform-free.
 * Day strings are local YYYY-MM-DD (localDayISO) — arithmetic reuses the
 * DST-proof UTC-parts approach from streak.ts.
 */
import { daysBetween } from './streak';

export interface WeightPoint { day: string; kg: number }
export interface SmoothedPoint extends WeightPoint { trendKg: number }

/**
 * Centered moving average over the points that actually exist inside the
 * window (no fabricated padding at the edges — the first point's trend is
 * the mean of itself and what follows within the half-window).
 */
export function smoothWeights(points: readonly WeightPoint[], window = 7): SmoothedPoint[] {
  const sorted = [...points].sort((a, b) => daysBetween(b.day, a.day));
  const half = Math.floor(window / 2);
  return sorted.map((p) => {
    const neighbors = sorted.filter((q) => Math.abs(daysBetween(p.day, q.day)) <= half);
    const trend = neighbors.reduce((s, q) => s + q.kg, 0) / neighbors.length;
    return { ...p, trendKg: Math.round(trend * 100) / 100 };
  });
}

/**
 * Least-squares slope in kg/week over the raw points.
 * null (honest "—") when fewer than 2 points or the span is under 7 days —
 * a slope extrapolated from a weekend of data is a lie with decimals.
 */
export function weeklySlopeKgPerWeek(points: readonly WeightPoint[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => daysBetween(b.day, a.day));
  const x0 = sorted[0]!.day;
  const span = daysBetween(x0, sorted[sorted.length - 1]!.day);
  if (span < 7) return null;
  const xs = sorted.map((p) => daysBetween(x0, p.day));
  const ys = sorted.map((p) => p.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  return Math.round((num / den) * 7 * 100) / 100; // per-day slope → per week
}

export interface DayValue { day: string; value: number }

/** Sum a numeric field of entries into one bucket per local day, for the
    last `n` days ending at `today` (inclusive). Days without entries are 0 —
    a real zero (nothing logged), rendered as an empty slot, not hidden. */
export function dailyTotals(
  entries: readonly { day: string; value: number }[],
  n: number,
  today: string,
): DayValue[] {
  const out: DayValue[] = [];
  for (let back = n - 1; back >= 0; back -= 1) {
    out.push({ day: addDays(today, -back), value: 0 });
  }
  const index = new Map(out.map((d, i) => [d.day, i]));
  for (const e of entries) {
    const i = index.get(e.day);
    if (i !== undefined) out[i]!.value = Math.round((out[i]!.value + e.value) * 10) / 10;
  }
  return out;
}

export interface WeekBucket { weekStart: string; hitDays: number; loggedDays: number }

/**
 * ISO weeks (Monday start), oldest→newest, `weeks` buckets ending with the
 * week containing `today`. A day "hits" when its protein total ≥ target.
 */
export function proteinDaysByWeek(
  dayProtein: readonly DayValue[],
  proteinTarget_g: number,
  weeks: number,
  today: string,
): WeekBucket[] {
  const thisMonday = mondayOf(today);
  const buckets: WeekBucket[] = [];
  for (let back = weeks - 1; back >= 0; back -= 1) {
    buckets.push({ weekStart: addDays(thisMonday, -7 * back), hitDays: 0, loggedDays: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const d of dayProtein) {
    const i = index.get(mondayOf(d.day));
    if (i === undefined) continue;
    if (d.value > 0) buckets[i]!.loggedDays += 1;
    if (proteinTarget_g > 0 && d.value >= proteinTarget_g) buckets[i]!.hitDays += 1;
  }
  return buckets;
}

/** Percent (0–100, rounded) of days since `startDay` with at least one log. */
export function loggedPercent(entryDays: readonly string[], startDay: string, today: string): number {
  const span = daysBetween(startDay, today) + 1;
  if (!Number.isFinite(span) || span <= 0) return 0;
  const distinct = new Set(entryDays.filter((d) => {
    const k = daysBetween(startDay, d);
    return Number.isFinite(k) && k >= 0 && k <= span - 1;
  }));
  return Math.round((distinct.size / span) * 100);
}

/* ---------- day-string helpers (UTC-parts, DST-proof) ---------- */

export function addDays(dayISO: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) return dayISO;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Monday of the ISO week containing the day. */
export function mondayOf(dayISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) return dayISO;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(dayISO, -dow);
}
