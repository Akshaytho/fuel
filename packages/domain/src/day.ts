import { DaySummary, LogEntryInput, Macros, Targets } from './types';
import { consumedFromEntries, round1 } from './macros';

/**
 * The calendar day an entry belongs to, in the user's LOCAL zone (YYYY-MM-DD).
 *
 * Never derive this from `toISOString()`: that is UTC, so east of Greenwich the
 * stored day disagrees with the date shown on screen — food logged at 01:00 IST
 * files under yesterday and drops off Today when the UTC date rolls over.
 */
export function localDayISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Ratio that tolerates a zero target (0 consumed / 0 target = 0, else ∞-safe 1+). */
function ratio(consumed: number, target: number): number {
  if (target <= 0) return consumed > 0 ? 1 : 0;
  return consumed / target;
}

/**
 * Aggregate a day's entries against targets → Today-screen summary.
 * remaining components go negative when over; progress is uncapped
 * (the UI decides how to display >100%).
 */
export function summarizeDay(entries: readonly LogEntryInput[], targets: Targets): DaySummary {
  const consumed: Macros = consumedFromEntries(entries);
  const remaining: Macros = {
    kcal: Math.round(targets.kcal - consumed.kcal),
    protein_g: round1(targets.protein_g - consumed.protein_g),
    carbs_g: round1(targets.carbs_g - consumed.carbs_g),
    fat_g: round1(targets.fat_g - consumed.fat_g),
  };
  return {
    consumed,
    remaining,
    progress: {
      kcal: ratio(consumed.kcal, targets.kcal),
      protein: ratio(consumed.protein_g, targets.protein_g),
      carbs: ratio(consumed.carbs_g, targets.carbs_g),
      fat: ratio(consumed.fat_g, targets.fat_g),
    },
    isOver: consumed.kcal > targets.kcal,
    entryCount: entries.length,
  };
}
