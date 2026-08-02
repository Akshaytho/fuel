/**
 * Fuel design tokens — extracted from the design doc's "Native" direction
 * (the production-flow screens). Single source of truth for all styling.
 * Rule (ADR-005): components import these; raw values are forbidden in app code.
 */

export const palette = {
  // iOS system palette as used by the production screens
  systemGroupedBg: '#F2F2F7',
  card: '#FFFFFF',
  label: '#000000',
  // iOS ships #8E8E93 / #0A84FF / #FF375F, none of which clear WCAG AA 4.5:1
  // for normal text on white — Apple's palette predates that floor. These are
  // the same hues at 75–80% luminance, which pass on BOTH light surfaces.
  // (The dark theme's own colors already pass; see packages/tokens/test.)
  secondaryLabel: '#8E8E93',
  secondaryLabelAA: '#6B6B6E',
  blueText: '#086ACC',
  pinkText: '#CC2C4C',
  pinkCta: '#C1233F',           // filled destructive button under white text
  blueTextDark: '#2F96FF',      // link text on DARK surfaces (AA on card+elevated)
  onAvatar: '#000000',          // ink on the orange avatar (white was 2.06:1)
  separator: '#E5E5EA',
  tertiaryFill: '#C7C7CC',
  blue: '#0A84FF',
  // Filled-button blue. #0A84FF under WHITE 17px semibold is 3.65:1 — below
  // the WCAG AA 4.5:1 floor for normal text, in BOTH themes. Found by the
  // first dark-mode render check. Same hue, scaled to 85% luminance → 4.85:1.
  blueCta: '#0970D9',
  green: '#34C759',
  orange: '#FF9F0A',
  purple: '#AF52DE',
  pink: '#FF375F',
  // tinted surfaces (sampled from production Summary/empty screens)
  softGreen: '#E9F9EE',
  softBlue: '#E9F2FF',
  softOrange: '#FFF2E5',
  softPurple: '#F3EDFC',
  darkSoftPurple: '#2A2140',
  greenDeep: '#1D7A3D',
  darkSoftGreen: '#1B3524',
  darkSoftBlue: '#16283C',
  darkSoftOrange: '#3A2A14',
  greenBright: '#58D97C',
  // dark counterparts (from "Summary dark" screen)
  darkBg: '#000000',
  darkCard: '#1C1C1E',
  darkCardElevated: '#2C2C2E',
  darkLabel: '#FFFFFF',
  darkSecondaryLabel: '#98989F',
  darkGreen: '#30D158',
  // Neutral "perspective" surface: the strip that tells a person their week is
  // still fine after an over-target day. Deliberately NOT green (that would
  // congratulate a blowout) and NOT red (that would scold one).
  neutralFill: '#E8E8ED',
  onNeutralFill: '#3C3C43',
  darkNeutralFill: '#2C2C2E',
  onDarkNeutralFill: '#EBEBF0',
  darkPurple: '#BF5AF2',
} as const;

/** Semantic theme — screens consume THESE names, never palette directly. */
export interface Theme {
  bg: string;
  card: string;
  cardElevated: string;
  label: string;
  secondaryLabel: string;
  separator: string;
  tint: string;          // primary action (log button, links)
  ringCalories: string;  // main progress ring
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
  danger: string;
  onTint: string;   // text/icon on a tint-colored surface
  shadow: string;
  success: string;      // "On pace" links, positive accents
  successBg: string;    // coach strip background
  onSuccessBg: string;  // coach strip text
  softBlueBg: string;   // tinted icon squares (empty-state rows)
  softOrangeBg: string;
  softPurpleBg: string;
  water: string;        // water card accent
  avatarBg: string;
  /** filled-CTA background — AA-safe under white label text */
  ctaBg: string;
  /** filled DESTRUCTIVE background — also AA-safe under white */
  dangerCta: string;
  /** ink on the avatar circle */
  onAvatarBg: string;
  /** neutral strip for factual perspective (neither praise nor blame) */
  infoBg: string;
  onInfoBg: string;
  /**
   * Green for SMALL non-text graphics that carry information on their own —
   * the week-strip dots above all. iOS #34C759 is 2.22:1 on a white card,
   * under the WCAG 1.4.11 3:1 floor for non-text content. The rings keep the
   * system green because every ring is duplicated verbatim by the number
   * printed beside it (1.4.11 exempts redundant presentation); a week dot has
   * no such text twin, so it must carry its own contrast.
   */
  successGraphic: string;
}

export const light: Theme = {
  bg: palette.systemGroupedBg,
  card: palette.card,
  cardElevated: palette.card,
  label: palette.label,
  secondaryLabel: palette.secondaryLabelAA,
  separator: palette.separator,
  tint: palette.blueText,
  ringCalories: palette.green,
  macroProtein: palette.orange,
  macroCarbs: palette.purple,
  macroFat: palette.blueText,
  danger: palette.pinkText,
  onTint: palette.card,
  shadow: palette.label,
  success: palette.green,
  successBg: palette.softGreen,
  onSuccessBg: palette.greenDeep,
  softBlueBg: palette.softBlue,
  softOrangeBg: palette.softOrange,
  softPurpleBg: palette.softPurple,
  water: palette.blue,
  avatarBg: palette.orange,
  ctaBg: palette.blueCta,
  dangerCta: palette.pinkCta,
  onAvatarBg: palette.onAvatar,
  infoBg: palette.neutralFill,
  onInfoBg: palette.onNeutralFill,
  successGraphic: palette.greenDeep,
};

export const dark: Theme = {
  bg: palette.darkBg,
  card: palette.darkCard,
  cardElevated: palette.darkCardElevated,
  label: palette.darkLabel,
  secondaryLabel: palette.darkSecondaryLabel,
  separator: palette.darkCardElevated,
  tint: palette.blueTextDark,
  ringCalories: palette.darkGreen,
  macroProtein: palette.orange,
  macroCarbs: palette.darkPurple,
  macroFat: palette.blueTextDark,
  danger: palette.pink,
  onTint: palette.darkLabel,
  shadow: palette.darkBg,
  success: palette.darkGreen,
  successBg: palette.darkSoftGreen,
  onSuccessBg: palette.greenBright,
  softBlueBg: palette.darkSoftBlue,
  softOrangeBg: palette.darkSoftOrange,
  softPurpleBg: palette.darkSoftPurple,
  water: palette.blue,
  avatarBg: palette.orange,
  ctaBg: palette.blueCta,
  dangerCta: palette.pinkCta,
  onAvatarBg: palette.onAvatar,
  infoBg: palette.darkNeutralFill,
  onInfoBg: palette.onDarkNeutralFill,
  successGraphic: palette.darkGreen,
};

/** 4pt spacing scale (matches the design's rhythm). */
export const space = {
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48,
} as const;

export const radius = {
  sm: 8, md: 12, card: 16, sheet: 24, pill: 999,
} as const;

/** iOS type ramp used across the mockups. */
export const type = {
  largeTitle: { size: 34, weight: '700' },
  title2: { size: 22, weight: '700' },
  headline: { size: 17, weight: '600' },
  body: { size: 17, weight: '400' },
  subhead: { size: 15, weight: '400' },
  footnote: { size: 13, weight: '400' },
  caption: { size: 12, weight: '500' },
} as const;
