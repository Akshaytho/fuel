import { describe, it, expect } from 'vitest';
import {
  checkCustomFood, atwaterKcal, parseFoodNumber,
  CUSTOM_NAME_MAX, KCAL_PER_100G_MAX,
} from '../src/customfood';

const base = {
  name: 'Amma dal tadka',
  kcal_per_100g: 120,
  protein_g_per_100g: 6,
  carbs_g_per_100g: 14,
  fat_g_per_100g: 4,
  fiber_g_per_100g: null,
};

describe('checkCustomFood — blocking rules', () => {
  it('accepts a plain home-cooked food with unknown fibre', () => {
    const r = checkCustomFood(base);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    // 4*6 + 4*14 + 9*4 = 116 → gap 4, far below the note threshold
    expect(r.energyGapKcal).toBeNull();
  });

  it('rejects an empty or whitespace name, accepts exactly the max length', () => {
    expect(checkCustomFood({ ...base, name: '   ' }).issues).toContain('name_empty');
    expect(checkCustomFood({ ...base, name: 'x'.repeat(CUSTOM_NAME_MAX) }).ok).toBe(true);
    expect(checkCustomFood({ ...base, name: 'x'.repeat(CUSTOM_NAME_MAX + 1) }).issues).toContain('name_long');
  });

  it('rejects impossible energy density but allows pure fat', () => {
    expect(checkCustomFood({ ...base, kcal_per_100g: 884, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 100 }).ok).toBe(true);
    expect(checkCustomFood({ ...base, kcal_per_100g: KCAL_PER_100G_MAX + 1 }).issues).toContain('kcal_range');
  });

  it('rejects negatives, NaN, and >100 g/100 g on every macro', () => {
    expect(checkCustomFood({ ...base, protein_g_per_100g: -1 }).issues).toContain('protein_range');
    expect(checkCustomFood({ ...base, carbs_g_per_100g: Number.NaN }).issues).toContain('carbs_range');
    expect(checkCustomFood({ ...base, fat_g_per_100g: 101 }).issues).toContain('fat_range');
  });

  it('fibre: null passes untouched, 0 is a real value, range still applies', () => {
    expect(checkCustomFood({ ...base, fiber_g_per_100g: null }).ok).toBe(true);
    expect(checkCustomFood({ ...base, fiber_g_per_100g: 0 }).ok).toBe(true);
    expect(checkCustomFood({ ...base, fiber_g_per_100g: -0.1 }).issues).toContain('fiber_range');
  });
});

describe('checkCustomFood — the Atwater note (their word wins)', () => {
  it('notes a large disagreement without blocking', () => {
    // macros imply 116 kcal; user typed 320 — gap 204, way past threshold
    const r = checkCustomFood({ ...base, kcal_per_100g: 320 });
    expect(r.ok).toBe(true);                 // never a blocker
    expect(r.energyGapKcal).toBe(204);
  });

  it('notes the gap in both directions', () => {
    const r = checkCustomFood({ ...base, kcal_per_100g: 40 });
    expect(r.ok).toBe(true);
    expect(r.energyGapKcal).toBe(-76);
  });

  it('stays silent on ordinary label rounding', () => {
    const r = checkCustomFood({ ...base, kcal_per_100g: 130 });
    expect(r.energyGapKcal).toBeNull();
  });

  it('never fires while a blocking issue exists', () => {
    const r = checkCustomFood({ ...base, kcal_per_100g: 320, protein_g_per_100g: -5 });
    expect(r.energyGapKcal).toBeNull();
  });
});

describe('atwaterKcal', () => {
  it('is 4/4/9 rounded', () => {
    expect(atwaterKcal(10, 10, 10)).toBe(170);
    expect(atwaterKcal(0, 0, 0)).toBe(0);
  });
});

describe('parseFoodNumber', () => {
  it('empty means null — the unknown-fibre case', () => {
    expect(parseFoodNumber('')).toBeNull();
    expect(parseFoodNumber('   ')).toBeNull();
  });
  it('accepts a decimal comma — half the world types 88,5', () => {
    expect(parseFoodNumber('88,5')).toBe(88.5);
  });
  it('garbage is NaN, not silently zero', () => {
    expect(Number.isNaN(parseFoodNumber('abc') as number)).toBe(true);
  });
  it('plain numbers parse', () => {
    expect(parseFoodNumber('0')).toBe(0);
    expect(parseFoodNumber('12.3')).toBe(12.3);
  });
});
