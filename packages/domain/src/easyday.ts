/**
 * Easy Day (spec 0016) — one tap logs your usual day.
 *
 * The strongest result in the adherence literature: simplified logging
 * produced 97% of days tracked vs 49% for detailed logging, with IDENTICAL
 * weight loss (JMIR Formative 2022, docs/research/0004 §1). Nobody in the
 * field ships it as a first-class mode — every competitor treats a low-effort
 * day as a failed day.
 *
 * Fuel already knows what "your usual" is: repeat meals (spec 0014) knows the
 * combinations you eat, go-tos (spec 0011) knows your staples per slot. An
 * Easy Day is those two engines composed at day level. Nothing is invented:
 * every item and portion comes from the user's own history, by the same
 * median-portion rule a repeat-meal tap uses.
 */
import { LoggedItem, GoTo, goTosForMeal } from './gotos';
import { RepeatMeal, repeatMealsFor } from './combos';

export const EASY_MEALS: readonly LoggedItem['meal'][] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** A single repeated food needs this many occurrences to count as a "usual". */
export const EASY_GOTO_MIN_COUNT = 3;
/** Below this many established meals, there is no "usual day" to offer. */
export const EASY_MIN_MEALS = 2;

export interface UsualMeal {
  meal: LoggedItem['meal'];
  /** what a tap logs for this slot — real foods at median portions */
  items: LoggedItem[];
  kcal: number;
  /** how the usual was established, for tests and future display */
  basis: 'combo' | 'goto';
}

export interface UsualDay {
  /** established slots that still have nothing logged today, in meal order */
  meals: UsualMeal[];
  kcal: number;
  /** "Breakfast + Lunch + Dinner" — built from the slots it logs */
  label: string;
  /** true when this is the full usual day, false when some slots were
      already logged and only the remainder is offered */
  complete: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The user's established usual for one meal slot, or null.
 *
 * Order of preference: the top repeat combo (2+ foods, 3+ days), then the top
 * meal-matched go-to with 3+ occurrences — a person whose breakfast is just
 * oatmeal has a usual breakfast of one food, and the combo engine deliberately
 * ignores single foods (spec 0014).
 */
export function usualFor(
  entries: readonly LoggedItem[],
  meal: LoggedItem['meal'],
  todayISO: string,
): UsualMeal | null {
  const combos: RepeatMeal[] = repeatMealsFor(entries, meal, todayISO, 1);
  const combo = combos[0];
  if (combo) {
    return { meal, items: combo.items, kcal: combo.kcal, basis: 'combo' };
  }
  const gotos: GoTo[] = goTosForMeal(entries, meal, todayISO, 1);
  const top = gotos[0];
  if (top && top.mealMatch && top.count >= EASY_GOTO_MIN_COUNT) {
    return {
      meal,
      items: [top],
      kcal: Math.round(top.kcal),
      basis: 'goto',
    };
  }
  return null;
}

/**
 * The usual day, minus anything already logged today. Null when fewer than
 * EASY_MIN_MEALS slots are established AT ALL — one habitual breakfast is not
 * a "usual day", and a brand-new user has no usual to offer.
 *
 * `complete` is judged against the ESTABLISHED slots: if breakfast is already
 * logged, the offer is the honest remainder ("your usual lunch + dinner").
 * When every established slot is logged, there is nothing left to offer.
 */
export function usualDayFor(
  entries: readonly LoggedItem[],
  todayISO: string,
): UsualDay | null {
  const established: UsualMeal[] = [];
  for (const meal of EASY_MEALS) {
    // history EXCLUDES today: today's own logs must not teach the usual,
    // and an easy-logged breakfast must not echo into tomorrow's offer twice
    const u = usualFor(entries.filter((e) => e.day !== todayISO), meal, todayISO);
    if (u) established.push(u);
  }
  if (established.length < EASY_MIN_MEALS) return null;

  const loggedToday = new Set(
    entries.filter((e) => e.day === todayISO).map((e) => e.meal),
  );
  const remaining = established.filter((u) => !loggedToday.has(u.meal));
  if (remaining.length === 0) return null;

  return {
    meals: remaining,
    kcal: Math.round(remaining.reduce((a, m) => a + m.kcal, 0)),
    label: remaining.map((m) => cap(m.meal)).join(' + '),
    complete: remaining.length === established.length,
  };
}
