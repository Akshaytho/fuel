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

/**
 * Over target by less than this fraction is rounding, not a blowout.
 *
 * 5 kcal over a 1,547 kcal target used to turn the whole nutrition card red.
 * The eating-disorder literature is specific about this: Eikey et al. found
 * red/green over-budget colouring triggering "guilt, embarrassment and shame",
 * and MacroFactor's published design commitment is that no number turns red
 * when you exceed a target. Fuel still SAYS she is 5 over — that is true and
 * she can read — but it does not sound an alarm about a rounding error.
 */
export const OVER_TOLERANCE = 0.05;

/** Ratio that tolerates a zero target (0 consumed / 0 target = 0, else ∞-safe 1+). */
function ratio(consumed: number, target: number): number {
  if (target <= 0) return consumed > 0 ? 1 : 0;
  return consumed / target;
}

/**
 * Already-aggregated consumed macros against targets → Today-screen summary.
 * This is THE shipped calculation path (B-21): AppRoot calls this directly
 * with the store's day totals, so the tested path IS the displayed path.
 * remaining components go negative when over; progress is uncapped
 * (the UI decides how to display >100%).
 */
export function summarizeConsumed(consumed: Macros, entryCount: number, targets: Targets): DaySummary {
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
    // The two are deliberately different: `isOver` is the literal fact and
    // drives the wording; this drives the COLOUR. See OVER_TOLERANCE.
    isMeaningfullyOver: targets.kcal > 0 && consumed.kcal > targets.kcal * (1 + OVER_TOLERANCE),
    entryCount,
  };
}

/** Convenience: raw entries → summary (scales + sums, then summarizes). */
export function summarizeDay(entries: readonly LogEntryInput[], targets: Targets): DaySummary {
  return summarizeConsumed(consumedFromEntries(entries), entries.length, targets);
}
