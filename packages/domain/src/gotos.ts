/**
 * Go-tos and copy-yesterday (spec 0011): logging faster from YOUR OWN
 * history. Pure and platform-free — the ranking is computed from real log
 * entries, never a curated list (data-in-DB rule: the history IS the data).
 */

export interface LoggedItem {
  food_id: string | null;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** spec 0015: fibre travels with a re-logged item so one-tap logging does
      not silently drop it — and stays UNKNOWN when it was never known. */
  fiber_g?: number | null | undefined;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  day: string;          // YYYY-MM-DD local
  logged_at: string;    // ISO
}

export interface GoTo extends LoggedItem {
  /** how many times this food was logged in the window */
  count: number;
  /** true when the count came from THIS meal specifically */
  mealMatch: boolean;
}

/** Identity for "the same food": prefer the database id; fall back to the
    name (manual/AI entries have no id but are still the same thing). */
export function foodKey(e: Pick<LoggedItem, 'food_id' | 'food_name'>): string {
  return e.food_id ?? `name:${e.food_name.trim().toLowerCase()}`;
}

export const GOTO_WINDOW_DAYS = 60;
export const GOTO_LIMIT = 4;

/**
 * E-06 (spec 0017): proximity BANDS for time-of-day ranking. Banded rather
 * than raw distance so a staple logged twenty times an hour off still beats a
 * one-off logged exactly now. Band 0: within 1 h. Band 1: within 3 h.
 * Band 2: the rest of the day.
 */
export const GOTO_HOUR_BANDS = [1, 3] as const;

/** Circular distance between two hours (23 vs 0 = 1, not 23). */
export function hourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

/** Median UTC hour of a set of ISO timestamps; null when none parse. */
export function medianHour(loggedAts: readonly string[]): number | null {
  const hours = loggedAts
    .map((iso) => new Date(iso).getUTCHours())
    .filter((h) => Number.isFinite(h))
    .sort((a, b) => a - b);
  if (hours.length === 0) return null;
  const mid = hours.length >> 1;
  return hours.length % 2 === 1 ? hours[mid]! : Math.round((hours[mid - 1]! + hours[mid]!) / 2);
}

function hourBand(dist: number): number {
  if (dist <= GOTO_HOUR_BANDS[0]) return 0;
  if (dist <= GOTO_HOUR_BANDS[1]) return 1;
  return 2;
}

/**
 * Rank the user's usual foods for a meal.
 *
 * Ordering: foods logged for THIS meal first (that's what "your breakfast
 * go-tos" means), then by how often, then by how recently. Foods from other
 * meals fill the remaining slots so the list is never uselessly empty for
 * someone who has logged plenty — just not at this hour.
 *
 * The returned macros/grams are the user's MOST RECENT logging of that food,
 * so a one-tap re-log reproduces what they actually ate last time.
 */
export function goTosForMeal(
  entries: readonly LoggedItem[],
  meal: LoggedItem['meal'],
  todayISO: string,
  limit = GOTO_LIMIT,
  windowDays = GOTO_WINDOW_DAYS,
  /**
   * E-06: current UTC hour. When given, foods whose TYPICAL logging hour is
   * near it rank first within the meal — the 7 am eggs person and the 10 am
   * oats person see different lists at 7 and at 10. Both sides are UTC, so
   * the timezone offset cancels; DST costs at most an hour, inside band 0.
   */
  hourOfDay?: number,
): GoTo[] {
  const cutoff = shiftDay(todayISO, -windowDays);
  const inWindow = entries.filter((e) => e.day >= cutoff && e.day <= todayISO);

  const groups = new Map<string, { items: LoggedItem[]; mealCount: number }>();
  for (const e of inWindow) {
    const k = foodKey(e);
    const g = groups.get(k) ?? { items: [], mealCount: 0 };
    g.items.push(e);
    if (e.meal === meal) g.mealCount += 1;
    groups.set(k, g);
  }

  const ranked: (GoTo & { band: number })[] = [];
  for (const { items, mealCount } of groups.values()) {
    // most recent logging of this food = what a re-log should reproduce
    const latest = [...items].sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1))[0]!;
    // typical hour comes from the meal-matched logs only — the same food at
    // dinner must not drag its breakfast hour around
    const mealLogs = items.filter((i) => i.meal === meal).map((i) => i.logged_at);
    const typical = medianHour(mealLogs.length > 0 ? mealLogs : items.map((i) => i.logged_at));
    const band = hourOfDay === undefined || typical === null
      ? 0
      : hourBand(hourDistance(typical, hourOfDay));
    ranked.push({
      ...latest,
      count: mealCount > 0 ? mealCount : items.length,
      mealMatch: mealCount > 0,
      band,
    });
  }

  ranked.sort((a, b) => {
    if (a.mealMatch !== b.mealMatch) return a.mealMatch ? -1 : 1;
    if (a.band !== b.band) return a.band - b.band;          // E-06: your 7 am foods at 7 am
    if (a.count !== b.count) return b.count - a.count;
    return a.logged_at < b.logged_at ? 1 : -1;
  });
  return ranked.map(({ band: _band, ...g }) => g).slice(0, limit);
}

/**
 * Everything logged on the day before `todayISO`. Used by "Copy yesterday" —
 * a real convenience for people whose days repeat, and honest by
 * construction: it copies what is actually in the log, nothing invented.
 */
export function yesterdaysItems(entries: readonly LoggedItem[], todayISO: string): LoggedItem[] {
  const y = shiftDay(todayISO, -1);
  return entries
    .filter((e) => e.day === y)
    .sort((a, b) => (a.logged_at < b.logged_at ? -1 : 1));
}

/** local-day string arithmetic (UTC parts — DST-proof, same as trends.ts) */
function shiftDay(dayISO: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) return dayISO;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
