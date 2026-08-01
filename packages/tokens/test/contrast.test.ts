/**
 * WCAG AA contrast is a TOKEN-LEVEL guarantee, not a per-screen hope.
 * Found by the first dark-mode render check: white 17px semibold on the
 * tint blue was 3.65:1 in BOTH themes — below the 4.5:1 floor for normal
 * text. These tests make that class of regression impossible to ship.
 */
import { describe, it, expect } from 'vitest';
import { light, dark, type Theme } from '../src/index';

const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const themes: [string, Theme][] = [['light', light], ['dark', dark]];

describe.each(themes)('%s theme meets WCAG AA', (_name, th) => {
  it('filled CTA: label on ctaBg >= 4.5:1 (normal text)', () => {
    expect(contrast(th.onTint, th.ctaBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('destructive filled button: white label on dangerCta >= 4.5:1', () => {
    expect(contrast(th.onTint, th.dangerCta)).toBeGreaterThanOrEqual(4.5);
  });

  it('avatar initial on avatarBg >= 4.5:1 (white on orange was 2.06:1)', () => {
    expect(contrast(th.onAvatarBg, th.avatarBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('body text on every surface >= 4.5:1', () => {
    for (const bg of [th.bg, th.card, th.cardElevated]) {
      expect(contrast(th.label, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('secondary text on every surface >= 4.5:1', () => {
    for (const bg of [th.bg, th.card]) {
      expect(contrast(th.secondaryLabel, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tint used as LINK text on card/bg >= 4.5:1', () => {
    // cardElevated included: sheets sit on it and 'link' text lives there too
    for (const bg of [th.bg, th.card, th.cardElevated]) {
      expect(contrast(th.tint, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('coach strip text on its own background >= 4.5:1', () => {
    expect(contrast(th.onSuccessBg, th.successBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('danger text on card >= 4.5:1 (destructive rows must be readable)', () => {
    expect(contrast(th.danger, th.card)).toBeGreaterThanOrEqual(4.5);
  });
});
