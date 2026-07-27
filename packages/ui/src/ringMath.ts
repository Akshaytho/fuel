/** Pure math for the ring arc — no react-native imports so it is testable in node. */
export function ringArc(progress: number, circumference: number): {
  dash: number;
  over: boolean;
} {
  if (!Number.isFinite(progress) || progress < 0) progress = 0;
  const over = progress > 1;
  const clamped = Math.min(progress, 1);
  return { dash: clamped * circumference, over };
}
