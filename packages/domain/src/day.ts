import { DaySummary, LogEntryInput, Macros, Targets } from './types';
import { consumedFromEntries, round1 } from './macros';

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
