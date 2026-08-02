/**
 * Meals you repeat (spec 0014).
 *
 * Cordeiro et al. measured the friction gradient every food tracker has and
 * nobody designs against: logging packaged food rates 6.3–6.5/10 for ease,
 * home-cooked meals 4.6/10. The app's own convenience curve nudges people
 * toward worse food. This inverts it — the more often you cook the same thing,
 * the closer it gets to one tap.
 *
 * Stored: nothing. A repeat meal is derived from the log history, like go-tos.
 * Nothing to name, maintain, sync or let go stale.
 */
import { LoggedItem, foodKey } from './gotos';
import { scaleFiber } from './fibre';

export const REPEAT_WINDOW_DAYS = 60;
/** Distinct days a combination must appear on before we call it a habit. */
export const REPEAT_MIN_DAYS = 3;
export const REPEAT_LIMIT = 3;
/** One food is a go-to, not a meal. Offering it here would just be noise. */
export const REPEAT_MIN_ITEMS = 2;

export interface RepeatMeal {
  /** stable identity: the sorted foodKeys joined */
  id: string;
  meal: LoggedItem['meal'];
  /** "Oats + banana + milk" — built from the items, so it cannot disagree */
  label: string;
  /** what a tap logs: one entry per food, at the median grams eaten */
  items: LoggedItem[];
  /** distinct days this combination appeared on, inside the window */
  days: number;
  kcal: number;
  /** most recent day it was eaten */
  lastDay: string;
}

function median(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * The combinations this person actually repeats, for one meal slot.
 *
 * Portions come from the MEDIAN across every time they ate the combination,
 * not the most recent — the median shrugs off the one morning they weighed out
 * something unusual, which is exactly the day you don't want to enshrine.
 */
export function repeatMealsFor(
  entries: readonly LoggedItem[],
  meal: LoggedItem['meal'],
  todayISO: string,
  limit = REPEAT_LIMIT,
  windowDays = REPEAT_WINDOW_DAYS,
): RepeatMeal[] {
  const cutoff = shiftDay(todayISO, -windowDays);

  // day + meal -> the foods eaten together
  const plates = new Map<string, LoggedItem[]>();
  for (const e of entries) {
    if (e.meal !== meal) continue;
    if (e.day < cutoff || e.day > todayISO) continue;
    const k = `${e.day}`;
    const arr = plates.get(k) ?? [];
    arr.push(e);
    plates.set(k, arr);
  }

  // combo identity -> every occurrence of it
  const combos = new Map<string, { days: Set<string>; items: LoggedItem[]; lastDay: string }>();
  for (const [day, plate] of plates) {
    const keys = [...new Set(plate.map(foodKey))].sort();
    if (keys.length < REPEAT_MIN_ITEMS) continue;
    const id = keys.join('|');
    const c = combos.get(id) ?? { days: new Set<string>(), items: [], lastDay: day };
    c.days.add(day);
    c.items.push(...plate);
    if (day > c.lastDay) c.lastDay = day;
    combos.set(id, c);
  }

  const out: RepeatMeal[] = [];
  for (const [id, c] of combos) {
    if (c.days.size < REPEAT_MIN_DAYS) continue;

    // one representative entry per food, at the median grams and scaled macros
    const byFood = new Map<string, LoggedItem[]>();
    for (const e of c.items) {
      const k = foodKey(e);
      byFood.set(k, [...(byFood.get(k) ?? []), e]);
    }
    const items: LoggedItem[] = [];
    for (const group of byFood.values()) {
      const latest = [...group].sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1))[0]!;
      const g = median(group.map((x) => x.grams));
      // Scale from the latest logging so the macro ratios stay that food's,
      // rather than averaging four numbers that were never eaten together.
      const f = latest.grams > 0 ? g / latest.grams : 1;
      items.push({
        ...latest,
        grams: Math.round(g * 10) / 10,
        kcal: Math.round(latest.kcal * f),
        protein_g: Math.round(latest.protein_g * f * 10) / 10,
        carbs_g: Math.round(latest.carbs_g * f * 10) / 10,
        fat_g: Math.round(latest.fat_g * f * 10) / 10,
        // spec 0015: scale from the latest per-portion figure; unknown stays
        // unknown rather than becoming a confident zero.
        fiber_g: latest.grams > 0
          ? scaleFiber(
              latest.fiber_g === null || latest.fiber_g === undefined
                ? null : (latest.fiber_g / latest.grams) * 100,
              g)
          : latest.fiber_g ?? null,
      });
    }
    items.sort((a, b) => (a.food_name < b.food_name ? -1 : 1));

    out.push({
      id, meal,
      label: items.map((i) => i.food_name).join(' + '),
      items,
      days: c.days.size,
      kcal: Math.round(items.reduce((a, b) => a + b.kcal, 0)),
      lastDay: c.lastDay,
    });
  }

  out.sort((a, b) => {
    if (a.days !== b.days) return b.days - a.days;
    if (a.lastDay !== b.lastDay) return a.lastDay < b.lastDay ? 1 : -1;
    return a.id < b.id ? -1 : 1;          // total order, so ties are stable
  });
  return out.slice(0, limit);
}

/** local-day string arithmetic (UTC parts — DST-proof, same as gotos.ts) */
function shiftDay(dayISO: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) return dayISO;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
