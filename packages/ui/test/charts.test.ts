import { describe, it, expect } from 'vitest';
import { niceScale, yPos, rampOpacity, roundedTopBar } from '../src/chartMath';

describe('niceScale', () => {
  it('pads the range and survives a flat series', () => {
    const s = niceScale([70, 71, 69]);
    expect(s.min).toBeLessThan(69);
    expect(s.max).toBeGreaterThan(71);
    const flat = niceScale([70, 70]);
    expect(flat.max).toBeGreaterThan(flat.min); // no divide-by-zero downstream
  });

  it('empty input yields a sane unit scale', () => {
    expect(niceScale([])).toEqual({ min: 0, max: 1 });
  });
});

describe('yPos', () => {
  it('maps min→bottom, max→top', () => {
    const s = { min: 0, max: 100 };
    expect(yPos(0, s, 150)).toBe(150);
    expect(yPos(100, s, 150)).toBe(0);
    expect(yPos(50, s, 150)).toBe(75);
  });
});

describe('rampOpacity (dataviz: sequential = monotonic lightness)', () => {
  it('is strictly monotonic in value — AC3', () => {
    const max = 7;
    let prev = -1;
    for (let v = 0; v <= max; v += 1) {
      const o = rampOpacity(v, max);
      expect(o).toBeGreaterThan(prev);
      prev = o;
    }
  });

  it('clamps to [0.22, 1] and survives zero max', () => {
    expect(rampOpacity(0, 7)).toBe(0.22);
    expect(rampOpacity(7, 7)).toBe(1);
    expect(rampOpacity(99, 7)).toBe(1);
    expect(rampOpacity(3, 0)).toBe(0.22);
  });
});

describe('roundedTopBar', () => {
  it('rounds only the data end; baseline stays square', () => {
    const d = roundedTopBar(10, 20, 20, 60, 4);
    expect(d).toContain('M 10 80');       // starts at the baseline
    expect(d.match(/Q/g)).toHaveLength(2); // two rounded corners, both at the top
    expect(d.endsWith('Z')).toBe(true);
  });

  it('radius collapses gracefully on tiny bars', () => {
    expect(() => roundedTopBar(0, 0, 4, 2, 4)).not.toThrow();
  });
});
