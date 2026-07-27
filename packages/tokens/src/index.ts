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
  secondaryLabel: '#8E8E93',
  separator: '#E5E5EA',
  tertiaryFill: '#C7C7CC',
  blue: '#0A84FF',
  green: '#34C759',
  orange: '#FF9F0A',
  purple: '#AF52DE',
  pink: '#FF375F',
  // dark counterparts (from "Summary dark" screen)
  darkBg: '#000000',
  darkCard: '#1C1C1E',
  darkCardElevated: '#2C2C2E',
  darkLabel: '#FFFFFF',
  darkSecondaryLabel: '#98989F',
  darkGreen: '#30D158',
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
}

export const light: Theme = {
  bg: palette.systemGroupedBg,
  card: palette.card,
  cardElevated: palette.card,
  label: palette.label,
  secondaryLabel: palette.secondaryLabel,
  separator: palette.separator,
  tint: palette.blue,
  ringCalories: palette.green,
  macroProtein: palette.blue,
  macroCarbs: palette.orange,
  macroFat: palette.purple,
  danger: palette.pink,
  onTint: palette.card,
  shadow: palette.label,
};

export const dark: Theme = {
  bg: palette.darkBg,
  card: palette.darkCard,
  cardElevated: palette.darkCardElevated,
  label: palette.darkLabel,
  secondaryLabel: palette.darkSecondaryLabel,
  separator: palette.darkCardElevated,
  tint: palette.blue,
  ringCalories: palette.darkGreen,
  macroProtein: palette.blue,
  macroCarbs: palette.orange,
  macroFat: palette.darkPurple,
  danger: palette.pink,
  onTint: palette.darkLabel,
  shadow: palette.darkBg,
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
