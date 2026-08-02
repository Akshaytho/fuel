/** Pure math for the ring arc — no react-native imports so it is testable in node. */
/**
 * Over by less than this fraction of the target is rounding, not a blowout —
 * mirrors OVER_TOLERANCE in @fuel/domain. The ring is the loudest element on
 * the screen; it must not go red because someone ate five extra calories.
 * (Duplicated rather than imported: @fuel/ui does not depend on @fuel/domain,
 * and ringMath is deliberately dependency-free. The pairing is asserted in
 * packages/ui/test/ring.test.ts.)
 */
export const RING_OVER_TOLERANCE = 0.05;

export function ringArc(progress: number, circumference: number): {
  dash: number;
  over: boolean;
} {
  if (!Number.isFinite(progress) || progress < 0) progress = 0;
  const over = progress > 1 + RING_OVER_TOLERANCE;
  const clamped = Math.min(progress, 1);
  return { dash: clamped * circumference, over };
}
