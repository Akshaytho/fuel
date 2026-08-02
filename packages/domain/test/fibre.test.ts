import { describe, it, expect } from 'vitest';
import {
  fiberTargetG, summarizeFiber, scaleFiber,
  FIBER_G_PER_1000_KCAL, FIBER_COVERAGE_MIN, type FiberItem,
} from '../src/fibre';

describe('the target is the IOM Adequate Intake, per energy', () => {
  it('is 14 g per 1,000 kcal', () => {
    expect(FIBER_G_PER_1000_KCAL).toBe(14);
    expect(fiberTargetG(1000)).toBe(14);
    expect(fiberTargetG(1547)).toBe(22);
  });

  it('reproduces the familiar 25 g / 38 g figures at the energy they assume', () => {
    expect(fiberTargetG(1800)).toBe(25);      // the "women: 25 g" number
    expect(fiberTargetG(2700)).toBe(38);      // the "men: 38 g" number
  });

  it('does not demand 25 g from someone eating 1,200 kcal', () => {
    expect(fiberTargetG(1200)).toBe(17);
  });

  it('is null rather than nonsense for a degenerate target', () => {
    expect(fiberTargetG(0)).toBeNull();
    expect(fiberTargetG(-5)).toBeNull();
    expect(fiberTargetG(Number.NaN)).toBeNull();
  });
});

describe('a missing figure is NOT a zero', () => {
  const T = 1547;

  it('counts a genuine 0 g as KNOWN', () => {
    // Oil, egg white, most meats: really no fibre. That is data, not a gap.
    const s = summarizeFiber([{ kcal: 200, fiber_g: 0 }, { kcal: 100, fiber_g: 3 }], T);
    expect(s.grams).toBe(3);
    expect(s.unknownItems).toBe(0);
    expect(s.coverage).toBe(1);
    expect(s.complete).toBe(true);
  });

  it('counts null / undefined / NaN as UNKNOWN, and never adds them in', () => {
    for (const missing of [null, undefined, Number.NaN]) {
      const s = summarizeFiber([{ kcal: 300, fiber_g: missing }, { kcal: 100, fiber_g: 4 }], T);
      expect(s.grams).toBe(4);
      expect(s.unknownItems).toBe(1);
      expect(s.knownKcal).toBe(100);
      expect(s.totalKcal).toBe(400);
      expect(s.coverage).toBeCloseTo(0.25, 5);
      expect(s.complete).toBe(false);
    }
  });

  it('flags a day where we know NOTHING, so the UI never prints "0 g"', () => {
    const s = summarizeFiber([{ kcal: 500, fiber_g: null }, { kcal: 300 }], T);
    expect(s.allUnknown).toBe(true);
    expect(s.grams).toBe(0);          // the number exists but must not be shown as a total
    expect(s.coverage).toBe(0);
  });

  it('is not "all unknown" the moment one item is known', () => {
    const s = summarizeFiber([{ kcal: 500, fiber_g: null }, { kcal: 300, fiber_g: 0 }], T);
    expect(s.allUnknown).toBe(false);
  });

  it('an empty day is complete and covered, not a data failure', () => {
    const s = summarizeFiber([], T);
    expect(s.coverage).toBe(1);
    expect(s.allUnknown).toBe(false);
    expect(s.unknownItems).toBe(0);
    expect(s.totalKcal).toBe(0);
  });

  it('coverage is by CALORIES, not by item count', () => {
    // one huge unknown item and three tiny known ones is mostly unknown
    const items: FiberItem[] = [
      { kcal: 900, fiber_g: null },
      { kcal: 20, fiber_g: 1 }, { kcal: 20, fiber_g: 1 }, { kcal: 20, fiber_g: 1 },
    ];
    const s = summarizeFiber(items, T);
    expect(s.coverage).toBeCloseTo(60 / 960, 4);
    expect(s.complete).toBe(false);
  });

  it('the completeness floor is the documented one', () => {
    expect(FIBER_COVERAGE_MIN).toBe(0.8);
    const ok = summarizeFiber([{ kcal: 900, fiber_g: 10 }, { kcal: 100, fiber_g: 2 }], T);
    expect(ok.complete).toBe(true);
    const notOk = summarizeFiber([{ kcal: 700, fiber_g: 10 }, { kcal: 300, fiber_g: null }], T);
    expect(notOk.complete).toBe(false);
  });
});

describe('progress never becomes a deficit to repay', () => {
  it('reports progress past 1 without inventing a penalty', () => {
    const s = summarizeFiber([{ kcal: 1500, fiber_g: 44 }], 1547);
    expect(s.progress).toBeCloseTo(2, 1);
    expect(s.grams).toBe(44);
  });

  it('has no progress when there is no target', () => {
    expect(summarizeFiber([{ kcal: 100, fiber_g: 2 }], 0).progress).toBeNull();
  });

  it('ignores negative or non-finite calories rather than corrupting coverage', () => {
    const s = summarizeFiber([{ kcal: -50, fiber_g: 2 }, { kcal: Number.NaN, fiber_g: 1 }], 1547);
    expect(s.totalKcal).toBe(0);
    expect(s.grams).toBe(3);
    expect(s.coverage).toBe(1);
  });

  it('clamps a negative fibre figure rather than subtracting it', () => {
    expect(summarizeFiber([{ kcal: 100, fiber_g: -4 }], 1547).grams).toBe(0);
  });
});

describe('scaleFiber preserves unknown', () => {
  it('scales a known figure to the portion', () => {
    expect(scaleFiber(5.3, 200)).toBe(10.6);
    expect(scaleFiber(2.6, 50)).toBe(1.3);
    expect(scaleFiber(0, 300)).toBe(0);          // genuinely none, at any size
  });

  it('returns NULL, not 0, when the food has no figure', () => {
    expect(scaleFiber(null, 200)).toBeNull();
    expect(scaleFiber(undefined, 200)).toBeNull();
    expect(scaleFiber(Number.NaN, 200)).toBeNull();
  });

  it('refuses nonsense portions rather than guessing', () => {
    expect(scaleFiber(5, -10)).toBeNull();
    expect(scaleFiber(5, Number.NaN)).toBeNull();
    expect(scaleFiber(5, 0)).toBe(0);
  });
});

describe('rule 0c — two years of entries', () => {
  it('summarises a heavy day list inside the perf budget', () => {
    const items: FiberItem[] = Array.from({ length: 20000 }, (_, i) => ({
      kcal: 100 + (i % 300),
      fiber_g: i % 7 === 0 ? null : (i % 11) / 2,
    }));
    const t0 = Date.now();
    const s = summarizeFiber(items, 2000);
    expect(Date.now() - t0).toBeLessThan(60);
    expect(s.unknownItems).toBeGreaterThan(0);
    expect(s.coverage).toBeGreaterThan(0);
    expect(s.coverage).toBeLessThan(1);
  });

  it('legacy entries logged before this spec are unknown, not zero', () => {
    // exactly what a pre-0015 row deserializes to
    const legacy = [{ kcal: 400 }, { kcal: 250 }];
    const s = summarizeFiber(legacy, 1547);
    expect(s.allUnknown).toBe(true);
    expect(s.unknownItems).toBe(2);
  });
});
