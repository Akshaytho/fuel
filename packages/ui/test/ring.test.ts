import { describe, it, expect } from 'vitest';
import { ringArc, RING_OVER_TOLERANCE } from '../src/ringMath';

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

describe('the ring does not sound an alarm about a rounding error', () => {
  it('stays on-colour at and just past the target', () => {
    // 5 kcal over 1,547 is progress 1.0032. Turning the loudest element on the
    // screen red for that is the exact red/green pattern the eating-disorder
    // literature identifies as triggering guilt and shame.
    expect(ringArc(1.0032, 100).over).toBe(false);
    expect(ringArc(1, 100).over).toBe(false);
    expect(ringArc(1 + RING_OVER_TOLERANCE, 100).over).toBe(false);
  });

  it('does go red for a real overshoot', () => {
    expect(ringArc(1.06, 100).over).toBe(true);
    expect(ringArc(2.34, 100).over).toBe(true);   // Sam's 3,614 on a 1,547 target
  });

  it('still fills exactly one full circle however far over', () => {
    expect(ringArc(1.0032, 100).dash).toBe(100);
    expect(ringArc(9, 100).dash).toBe(100);
  });

  it('is paired with the domain threshold it mirrors', () => {
    // @fuel/ui deliberately does not depend on @fuel/domain, so this constant
    // is duplicated. If OVER_TOLERANCE in packages/domain/src/day.ts changes,
    // this must change with it.
    expect(RING_OVER_TOLERANCE).toBe(0.05);
  });
});
