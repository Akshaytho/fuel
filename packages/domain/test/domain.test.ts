import { describe, it, expect } from 'vitest';
import {
  bmr, tdee, computeTargets, KCAL_FLOOR,
  scalePer100g, sumMacros, kcalFromMacros, kcalMismatch, consumedFromEntries,
  summarizeDay,
  InvalidInputError,
  type Profile, type FoodPer100g, type Targets,
} from '../src/index.js';

// Reference profile A (hand-computed in spec 0001):
// male 70kg 175cm 30y → BMR = 10*70 + 6.25*175 - 5*30 + 5 = 1648.75
// moderate ×1.55 → TDEE 2555.5625 · lose −20% → 2044.45 kcal
const profileA: Profile = {
  sex: 'male', age_years: 30, height_cm: 175, weight_kg: 70,
  activity: 'moderate', goal: 'lose',
};

// Reference profile B: female 60kg 162cm 26y
// BMR = 600 + 1012.5 - 130 - 161 = 1321.5 · light ×1.375 → 1817.0625 · maintain
const profileB: Profile = {
  sex: 'female', age_years: 26, height_cm: 162, weight_kg: 60,
  activity: 'light', goal: 'maintain',
};

describe('targets (AC1)', () => {
  it('matches hand-computed BMR/TDEE for reference profile A', () => {
    expect(bmr(profileA)).toBeCloseTo(1648.75, 2);
    expect(tdee(profileA)).toBeCloseTo(2555.5625, 2);
  });

  it('computes goal-adjusted targets for profile A (lose)', () => {
    const t = computeTargets(profileA);
    expect(t.kcal).toBe(2044); // TDEE − 20% (under the 1000 kcal cap), rounded
    expect(t.protein_g).toBeCloseTo(140, 1); // lose → 2.0 g/kg × 70 (BMI 22.9, no adjustment)
    // fat = 30% of 2044.45 kcal / 9 = 68.1483…
    expect(t.fat_g).toBeCloseTo(68.1, 1);
    // carbs = (2044.45 − 560 − 613.335) / 4 = 217.78
    expect(t.carbs_g).toBeCloseTo(217.8, 1);
    expect(t.clamped).toBe(false);
  });

  it('computes maintain targets for profile B', () => {
    const t = computeTargets(profileB);
    expect(bmr(profileB)).toBeCloseTo(1321.5, 2);
    expect(t.kcal).toBe(1817); // 1817.0625 rounded
    expect(t.protein_g).toBeCloseTo(96, 1); // maintain → 1.6 g/kg × 60
    expect(t.clamped).toBe(false);
  });

  it('macros always sum to the calorie target (research 0001 invariant 1)', () => {
    for (const p of [profileA, profileB,
      { ...profileA, goal: 'gain' as const }, { ...profileB, goal: 'lose' as const },
      { ...profileA, weight_kg: 150 }, { ...profileB, weight_kg: 40, age_years: 80 }]) {
      const t = computeTargets(p);
      const sum = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
      expect(Math.abs(sum - t.kcal)).toBeLessThanOrEqual(3); // rounding slack only
      expect(t.carbs_g).toBeGreaterThanOrEqual(0);
    }
  });

  it('caps the deficit at 1000 kcal/day for very high TDEEs (research §3)', () => {
    const big: Profile = { sex: 'male', age_years: 30, height_cm: 200, weight_kg: 180, activity: 'very_active', goal: 'lose' };
    // TDEE 5519.5 → −20% would be 1103.9; capped at 1000 → 4519.5 → 4520
    expect(computeTargets(big).kcal).toBe(4520);
  });

  it('caps the surplus at 500 kcal/day (research §3)', () => {
    const big: Profile = { sex: 'male', age_years: 30, height_cm: 200, weight_kg: 180, activity: 'very_active', goal: 'gain' };
    // TDEE 5519.5 → +10% would be 551.95; capped at 500 → 6019.5 → 6020
    expect(computeTargets(big).kcal).toBe(6020);
  });

  it('doses protein by ADJUSTED weight above BMI 25 (research §5)', () => {
    const heavy: Profile = { sex: 'male', age_years: 40, height_cm: 180, weight_kg: 150, activity: 'moderate', goal: 'lose' };
    // BMI-25 weight = 81 kg; reference = 81 + 0.25×69 = 98.25 → 2.0 g/kg = 196.5 g
    // (total-weight dosing would have said 300 g — a broken plan)
    expect(computeTargets(heavy).protein_g).toBeCloseTo(196.5, 1);
  });

  it('caps protein at 35% of calories when g/kg would exceed it (AMDR)', () => {
    // journey profile: female 28y 165cm 68.2kg light lose → kcal 1553.475
    const p: Profile = { sex: 'female', age_years: 28, height_cm: 165, weight_kg: 68.2, activity: 'light', goal: 'lose' };
    const t = computeTargets(p);
    expect(t.kcal).toBe(1553);
    expect(t.protein_g).toBeCloseTo(135.9, 1); // capped at 0.35 × 1553.475 / 4
    expect(t.protein_g * 4).toBeLessThanOrEqual(0.35 * 1553.475 + 0.5);
  });
});

describe('input validation (AC2)', () => {
  const bad = [0, -5, NaN, Infinity];
  for (const v of bad) {
    it(`rejects weight_kg = ${v}`, () => {
      expect(() => computeTargets({ ...profileA, weight_kg: v })).toThrow(InvalidInputError);
    });
    it(`rejects height_cm = ${v}`, () => {
      expect(() => computeTargets({ ...profileA, height_cm: v })).toThrow(InvalidInputError);
    });
    it(`rejects age_years = ${v}`, () => {
      expect(() => computeTargets({ ...profileA, age_years: v })).toThrow(InvalidInputError);
    });
  }

  it('rejects negative grams in scaling', () => {
    const food: FoodPer100g = { kcal: 100, protein_g: 10, carbs_g: 5, fat_g: 3 };
    expect(() => scalePer100g(food, -1)).toThrow(InvalidInputError);
    expect(() => scalePer100g(food, NaN)).toThrow(InvalidInputError);
  });

  it('produces finite numbers at plausible extremes (no NaN/Infinity)', () => {
    const t = computeTargets({
      sex: 'female', age_years: 99, height_cm: 210, weight_kg: 200,
      activity: 'very_active', goal: 'gain',
    });
    for (const v of [t.kcal, t.protein_g, t.carbs_g, t.fat_g]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('safety floor (AC3, sex-specific per research §4)', () => {
  it('clamps a small female profile to 1200 and flags it', () => {
    const t = computeTargets({
      sex: 'female', age_years: 80, height_cm: 145, weight_kg: 40,
      activity: 'sedentary', goal: 'lose',
    });
    expect(t.kcal).toBe(KCAL_FLOOR.female);
    expect(t.kcal).toBe(1200);
    expect(t.clamped).toBe(true);
  });

  it('clamps a small male profile to 1500 (not 1200) and flags it', () => {
    const t = computeTargets({
      sex: 'male', age_years: 60, height_cm: 150, weight_kg: 45,
      activity: 'sedentary', goal: 'lose',
    });
    expect(t.kcal).toBe(KCAL_FLOOR.male);
    expect(t.kcal).toBe(1500);
    expect(t.clamped).toBe(true);
  });
});

describe('portion scaling (AC4)', () => {
  // chicken breast-ish per 100g
  const food: FoodPer100g = { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 };

  it('scales 150 g correctly with rounding', () => {
    const m = scalePer100g(food, 150);
    expect(m.kcal).toBe(248);        // 247.5 → half-up
    expect(m.protein_g).toBe(46.5);
    expect(m.carbs_g).toBe(0);
    expect(m.fat_g).toBe(5.4);
  });

  it('0 g portion is legal and yields zero macros', () => {
    const m = scalePer100g(food, 0);
    expect(m).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });

  it('sums entries stably (rounding at the edges)', () => {
    const entries = [
      { per100g: food, grams: 150 },
      { per100g: { kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 }, grams: 118 }, // banana
    ];
    const total = consumedFromEntries(entries);
    expect(total.kcal).toBe(248 + 105); // banana 89×1.18 = 105.02 → 105
    expect(total.protein_g).toBeCloseTo(46.5 + 1.3, 5);
  });
});

describe('day summary (AC5)', () => {
  const targets: Targets = { kcal: 2000, protein_g: 120, carbs_g: 220, fat_g: 65, clamped: false };
  const food: FoodPer100g = { kcal: 200, protein_g: 12, carbs_g: 20, fat_g: 8 };

  it('empty day: zero consumed, remaining = targets, zero progress, not over', () => {
    const s = summarizeDay([], targets);
    expect(s.consumed.kcal).toBe(0);
    expect(s.remaining).toEqual({ kcal: 2000, protein_g: 120, carbs_g: 220, fat_g: 65 });
    expect(s.progress.kcal).toBe(0);
    expect(s.isOver).toBe(false);
    expect(s.entryCount).toBe(0);
  });

  it('normal day computes remaining and progress', () => {
    const s = summarizeDay([{ per100g: food, grams: 500 }], targets); // 1000 kcal
    expect(s.consumed.kcal).toBe(1000);
    expect(s.remaining.kcal).toBe(1000);
    expect(s.progress.kcal).toBeCloseTo(0.5, 5);
    expect(s.isOver).toBe(false);
  });

  it('over-target day: negative remaining, ratio > 1, isOver', () => {
    const s = summarizeDay([{ per100g: food, grams: 1200 }], targets); // 2400 kcal
    expect(s.remaining.kcal).toBe(-400);
    expect(s.progress.kcal).toBeGreaterThan(1);
    expect(s.isOver).toBe(true);
  });

  it('zero-target component never divides by zero', () => {
    const zeroCarbTargets: Targets = { ...targets, carbs_g: 0 };
    const s = summarizeDay([{ per100g: food, grams: 100 }], zeroCarbTargets);
    expect(Number.isFinite(s.progress.carbs)).toBe(true);
    expect(s.progress.carbs).toBe(1); // consumed against zero target → capped signal
  });
});

describe('kcal honesty check (AC6)', () => {
  it('passes a clean record', () => {
    // 31×4 + 0×4 + 3.6×9 = 156.4 vs stated 165 → 5.2% within 8%
    expect(kcalMismatch({ kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 })).toBe(false);
  });

  it('flags a mismatched record', () => {
    // macros say 156.4, stated 250 → 37% off
    expect(kcalMismatch({ kcal: 250, protein_g: 31, carbs_g: 0, fat_g: 3.6 })).toBe(true);
  });

  it('flags stated-zero kcal with nonzero macros', () => {
    expect(kcalMismatch({ kcal: 0, protein_g: 10, carbs_g: 10, fat_g: 5 })).toBe(true);
  });

  it('kcalFromMacros applies Atwater factors', () => {
    expect(kcalFromMacros({ protein_g: 10, carbs_g: 10, fat_g: 10 })).toBe(170);
  });
});

describe('sumMacros edge (AC7 coverage)', () => {
  it('sums an empty list to zeros', () => {
    expect(sumMacros([])).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });
});

describe('water target (spec 0007, clamped per research §7)', () => {
  it('35 ml/kg rounded to 0.25 L', async () => {
    const { waterLitersFor } = await import('../src/targets');
    expect(waterLitersFor(68.2)).toBe(2.5);   // 2.387 → 2.5
    expect(waterLitersFor(100)).toBe(3.5);
    expect(() => waterLitersFor(0)).toThrow();
  });

  it('clamps to [1.5, 4.0] L at extreme weights', async () => {
    const { waterLitersFor } = await import('../src/targets');
    expect(waterLitersFor(200)).toBe(4);    // 7 L unclamped — dangerous advice
    expect(waterLitersFor(30)).toBe(1.5);   // 1.05 L unclamped
  });
});
