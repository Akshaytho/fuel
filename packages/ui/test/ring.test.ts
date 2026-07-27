import { describe, it, expect } from 'vitest';
import { ringArc } from '../src/ringMath';

const C = 100; // easy circumference

describe('ringArc (spec 0003 AC2)', () => {
  it('0 progress → empty arc, not over', () => {
    expect(ringArc(0, C)).toEqual({ dash: 0, over: false });
  });
  it('0.5 → half arc', () => {
    expect(ringArc(0.5, C)).toEqual({ dash: 50, over: false });
  });
  it('1.0 → full arc, not over', () => {
    expect(ringArc(1, C)).toEqual({ dash: 100, over: false });
  });
  it('>1 → clamps to full and flags over (danger color)', () => {
    expect(ringArc(1.4, C)).toEqual({ dash: 100, over: true });
  });
  it('negative / NaN inputs → safe empty arc', () => {
    expect(ringArc(-2, C)).toEqual({ dash: 0, over: false });
    expect(ringArc(NaN, C)).toEqual({ dash: 0, over: false });
  });
});
