/**
 * Pure chart math (no react-native imports — vitest-loadable, like ringMath).
 */

export interface Scale { min: number; max: number }

/** y-scale with breathing room; degenerate (flat) series gets ±1 padding. */
export function niceScale(values: readonly number[], padFrac = 0.15): Scale {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * padFrac;
  return { min: min - pad, max: max + pad };
}

export function yPos(v: number, s: Scale, height: number): number {
  return height - ((v - s.min) / (s.max - s.min)) * height;
}

/**
 * Sequential single-hue ramp via opacity over the surface: opacity grows
 * strictly with value, so lightness is monotonic BY CONSTRUCTION (mixing one
 * hue toward the surface). Floor 0.22 keeps the smallest bar visible.
 */
export function rampOpacity(value: number, max: number): number {
  if (max <= 0) return 0.22;
  const f = Math.max(0, Math.min(1, value / max));
  return Math.round((0.22 + 0.78 * f) * 100) / 100;
}

/** Bar with a 4px-rounded DATA end and a square baseline end. */
export function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,                       // baseline left (square)
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,            // rounded top-left
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,    // rounded top-right
    `L ${x + w} ${y + h}`,                   // baseline right (square)
    'Z',
  ].join(' ');
}
