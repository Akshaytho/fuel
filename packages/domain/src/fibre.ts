/**
 * Fibre (spec 0015) — the first step from tracking QUANTITY to tracking
 * quality, and the first nutrient where "we don't know" is a real answer.
 *
 * Two ideas do all the work here:
 *
 * 1. The target is 14 g per 1,000 kcal — the IOM Adequate Intake, which is
 *    also where the familiar 25 g / 38 g figures come from (that same rule at
 *    ~1,800 and ~2,700 kcal). Using the per-energy form means a clamped
 *    1,200 kcal user is not told to eat 25 g.
 *
 * 2. A missing figure is NOT a zero. Of the foods currently seeded, 87 of 600
 *    report no fibre at all. Reading those as zero would tell someone they ate
 *    badly when the truth is that we don't know what they ate. So fibre is
 *    nullable end to end, and every total ships with the COVERAGE that
 *    produced it.
 */

/** IOM/NASEM Adequate Intake. https://www.ncbi.nlm.nih.gov/books/NBK559033/ */
export const FIBER_G_PER_1000_KCAL = 14;

/** Below this share of known calories, a total is a floor, not a total. */
export const FIBER_COVERAGE_MIN = 0.8;

export function fiberTargetG(targetKcal: number): number | null {
  if (!Number.isFinite(targetKcal) || targetKcal <= 0) return null;
  return Math.round((targetKcal / 1000) * FIBER_G_PER_1000_KCAL);
}

/** The shape the summary needs from a logged entry. */
export interface FiberItem {
  kcal: number;
  /** null/undefined = the source reported no figure. NEVER coerce to 0.
      `undefined` is spelled out because exactOptionalPropertyTypes is on and
      "explicitly unknown" is a value callers really do pass. */
  fiber_g?: number | null | undefined;
}

export interface FiberSummary {
  /** grams from the entries we DO have a figure for */
  grams: number;
  targetG: number | null;
  /** 0..1+ against the target; null when there is no target */
  progress: number | null;
  /** calories from entries with a known fibre figure */
  knownKcal: number;
  totalKcal: number;
  /** knownKcal / totalKcal, 0..1. 1 when nothing is logged. */
  coverage: number;
  /** entries whose fibre we do not know */
  unknownItems: number;
  /** true when we know enough for `grams` to be read as a total */
  complete: boolean;
  /** true when we know nothing at all — the strip must not show "0 g" */
  allUnknown: boolean;
}

export function summarizeFiber(
  items: readonly FiberItem[],
  targetKcal: number,
): FiberSummary {
  const targetG = fiberTargetG(targetKcal);
  let grams = 0;
  let knownKcal = 0;
  let totalKcal = 0;
  let unknownItems = 0;

  for (const it of items) {
    const kcal = Number.isFinite(it.kcal) && it.kcal > 0 ? it.kcal : 0;
    totalKcal += kcal;
    const f = it.fiber_g;
    // A genuine 0 counts as KNOWN — that is the whole point of the
    // distinction. Only null/undefined/NaN is unknown.
    if (f === null || f === undefined || !Number.isFinite(f)) {
      unknownItems += 1;
      continue;
    }
    grams += Math.max(0, f);
    knownKcal += kcal;
  }

  const coverage = totalKcal > 0 ? knownKcal / totalKcal : 1;
  const known = items.length - unknownItems;
  return {
    grams: Math.round(grams * 10) / 10,
    targetG,
    progress: targetG !== null && targetG > 0 ? grams / targetG : null,
    knownKcal: Math.round(knownKcal),
    totalKcal: Math.round(totalKcal),
    coverage,
    unknownItems,
    complete: coverage >= FIBER_COVERAGE_MIN && unknownItems === 0,
    allUnknown: items.length > 0 && known === 0,
  };
}

/**
 * Scale a per-100 g fibre figure to a portion, preserving "unknown".
 * Returns null — not 0 — when the food has no figure.
 */
export function scaleFiber(per100g: number | null | undefined, grams: number): number | null {
  if (per100g === null || per100g === undefined || !Number.isFinite(per100g)) return null;
  if (!Number.isFinite(grams) || grams < 0) return null;
  return Math.round(per100g * (grams / 100) * 10) / 10;
}
