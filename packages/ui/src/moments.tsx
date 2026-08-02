import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import { FadeSlideIn, pressedStyle, useReducedMotion } from './motion';
import { FlameIcon } from './icons';

/*
 * MOMENTS — the three things the five-day simulation proved were missing:
 * the week at a glance, the comeback, and the celebration (design 6a).
 * All presentational: every string and number is computed in @fuel/domain.
 */

// ---------------------------------------------------------------------------
// Week strip
// ---------------------------------------------------------------------------

export type WeekDotState = 'future' | 'today' | 'logged' | 'partial' | 'rested' | 'missed';
export interface WeekStripDay { day: string; letter: string; state: WeekDotState; onTarget: boolean }

/**
 * Seven dots answering "how has my week gone" without opening a chart.
 * A dot is never red: a missed day is a hollow outline, not an accusation.
 */
export function WeekStrip({ theme, days, summary, footnote, onPress, testID }: {
  theme: Theme;
  days: readonly WeekStripDay[];
  summary: string;
  footnote?: string | undefined;
  onPress?: (() => void) | undefined;
  testID?: string;
}) {
  const body = (
    <View style={{ backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4, gap: space.s3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text testID={testID} style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>
          {summary}
        </Text>
        {footnote !== undefined && (
          <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{footnote}</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d, i) => (
          <View key={d.day} style={{ alignItems: 'center', gap: space.s2, flex: 1 }}>
            <Text style={{
              fontSize: t.caption.size, fontWeight: '600',
              color: d.state === 'today' ? theme.tint : theme.secondaryLabel,
            }}>{d.letter}</Text>
            <View
              testID={`week-dot-${i}`}
              accessibilityLabel={`${d.day} ${d.state}`}
              style={{
                width: 22, height: 22, borderRadius: radius.pill,
                backgroundColor: d.state === 'logged'
                  ? (d.onTarget ? theme.successGraphic : theme.softOrangeBg)
                  : 'transparent',
                borderWidth: d.state === 'logged' && d.onTarget ? 0 : 2,
                borderColor: d.state === 'today' ? theme.tint
                  : d.state === 'logged' ? theme.macroProtein
                  // a half-logged day is drawn like a missed one, dashed, so
                  // the week never claims credit for a day it can't vouch for
                  : d.state === 'partial' ? theme.secondaryLabel
                  // a rest day is drawn as itself — warm, earned, and clearly
                  // not a logged day (spec 0013)
                  : d.state === 'rested' ? theme.macroProtein
                  : d.state === 'missed' ? theme.separator
                  : 'transparent',
                borderStyle: d.state === 'partial' ? 'dashed' : 'solid',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {d.state === 'logged' && d.onTarget && (
                <Svg width={12} height={12} viewBox="0 0 12 12">
                  <Path d="M2.5 6.4 L4.9 8.8 L9.5 3.4" stroke={theme.card} strokeWidth="2" fill="none"
                    strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
              {d.state === 'future' && (
                <View style={{ width: 5, height: 5, borderRadius: radius.pill, backgroundColor: theme.separator }} />
              )}
              {d.state === 'partial' && (
                <View style={{ width: 7, height: 2, borderRadius: radius.pill, backgroundColor: theme.secondaryLabel }} />
              )}
              {d.state === 'rested' && <FlameIcon color={theme.macroProtein} size={12} />}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress} style={({ pressed }) => [pressedStyle(pressed)]}>{body}</Pressable>;
}

// ---------------------------------------------------------------------------
// Comeback card
// ---------------------------------------------------------------------------

/** Shown instead of first-run copy when a user with history returns. */
export function ComebackCard({ theme, title, body, testID }: {
  theme: Theme; title: string; body: string; testID?: string;
}) {
  return (
    <View testID={testID} style={{
      flexDirection: 'row', alignItems: 'center', gap: space.s3,
      backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4,
    }}>
      <View style={{
        width: 40, height: 40, borderRadius: radius.sm + 2, backgroundColor: theme.softOrangeBg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <FlameIcon color={theme.macroProtein} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{title}</Text>
        <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{body}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Celebration (design 6a)
// ---------------------------------------------------------------------------

/** Positions lifted from design 6a, relative to the 190px mark. */
const CONFETTI: readonly {
  top?: number; left?: number; right?: number; bottom?: number;
  size: number; round: boolean; rotate: number; color: (t: Theme) => string;
}[] = [
  { top: 6, right: 2, size: 8, round: false, rotate: 24, color: (t) => t.macroProtein },
  { top: 34, left: -10, size: 7, round: true, rotate: 0, color: (t) => t.macroCarbs },
  { bottom: 16, right: -8, size: 7, round: true, rotate: 0, color: (t) => t.tint },
  { bottom: -4, left: 30, size: 8, round: false, rotate: -18, color: (t) => t.success },
];

/** Design 6a: "Shown once per day, never longer than 3 seconds." */
export const CELEBRATION_AUTO_DISMISS_MS = 3000;

export function CelebrationOverlay({ theme, title, body, streakLine, ctaLabel = 'Nice', onDismiss }: {
  theme: Theme;
  title: string;
  body: readonly string[];
  streakLine?: string | undefined;
  ctaLabel?: string;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion();
  useEffect(() => {
    // The design's own promise: it leaves on its own. A celebration that
    // needs dismissing is a chore, and a chore is not a reward.
    const id = setTimeout(onDismiss, CELEBRATION_AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [onDismiss]);

  const R = 80, C = 2 * Math.PI * R;
  return (
    <View testID="celebration" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center',
    }}>
      {/* radial-glow stand-in: RN has no radial gradient without a dep, so the
          design's green wash is a soft tinted disc behind the mark */}
      <View style={{
        position: 'absolute', width: 340, height: 340, borderRadius: radius.pill,
        backgroundColor: theme.successBg, opacity: 0.55, top: '18%',
      }} />
      <FadeSlideIn duration={reduced ? 0 : 420} offset={reduced ? 0 : 18}
        style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s8, flex: 0 }}>
        <View style={{ width: 190, height: 190, alignItems: 'center', justifyContent: 'center' }}>
          {/* design 6a's confetti — four flecks in the macro colors, the only
              purely decorative marks in the app, so they are aria-hidden */}
          {CONFETTI.map((c, i) => (
            <View key={i} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
              style={{
                position: 'absolute', top: c.top, left: c.left, right: c.right, bottom: c.bottom,
                width: c.size, height: c.size, borderRadius: c.round ? radius.pill : 2,
                backgroundColor: c.color(theme), transform: [{ rotate: `${c.rotate}deg` }],
              }} />
          ))}
          <Svg width={190} height={190} viewBox="0 0 190 190" style={{ position: 'absolute' }}>
            <Circle cx="95" cy="95" r={R} fill="none" stroke={theme.successBg} strokeWidth="14" />
            <Circle cx="95" cy="95" r={R} fill="none" stroke={theme.success} strokeWidth="14"
              strokeLinecap="round" strokeDasharray={`${C} ${C}`} transform="rotate(-90 95 95)" />
          </Svg>
          <Svg width={52} height={52} viewBox="0 0 52 52">
            <Circle cx="26" cy="26" r="24" fill={theme.success} />
            <Path d="M15 27.5 L22.5 35 L37 18" fill="none" stroke={theme.card} strokeWidth="4.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text testID="celebration-title" style={{
          fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: theme.label,
          marginTop: space.s6, textAlign: 'center',
        }}>{title}</Text>
        <View style={{ marginTop: space.s2, gap: 2 }}>
          {body.map((line) => (
            <Text key={line} style={{
              fontSize: t.subhead.size, color: theme.secondaryLabel, textAlign: 'center', lineHeight: 21,
            }}>{line}</Text>
          ))}
        </View>
        {streakLine !== undefined && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: space.s2, backgroundColor: theme.card,
            borderRadius: radius.pill, paddingVertical: space.s2 + 1, paddingHorizontal: space.s4,
            marginTop: space.s4,
          }}>
            <FlameIcon color={theme.macroProtein} size={15} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.label }}>{streakLine}</Text>
          </View>
        )}
      </FadeSlideIn>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.s6, paddingBottom: space.s5 }}>
        <Pressable testID="celebration-dismiss" onPress={onDismiss} style={({ pressed }) => [{
          backgroundColor: theme.ctaBg, borderRadius: radius.card, alignItems: 'center', paddingVertical: space.s4,
        }, pressedStyle(pressed)]}>
          <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: theme.onTint }}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Nutrient strip (spec 0015)
// ---------------------------------------------------------------------------

/**
 * A slim, deliberately quiet row for a nutrient that is INFORMATION rather
 * than a target to chase. The clinical guidance on fibre is to raise intake by
 * 2–3 g every few days, so a bar that turns red or accrues a deficit would be
 * telling people to do the one thing the evidence says not to do. This bar
 * fills, stops at full, and never changes colour to scold.
 */
export function NutrientStrip({ theme, label, value, caption, progress, unknown, testID }: {
  theme: Theme;
  label: string;
  /** already formatted, e.g. "14 g / 22 g" or "at least 14 g / 22 g" */
  value: string;
  caption?: string | undefined;
  /** 0..1+; clamped for display. Omit when there is nothing to show. */
  progress?: number | undefined;
  /** we know nothing at all — draw the empty track, never a full-looking bar */
  unknown?: boolean | undefined;
  testID?: string;
}) {
  const pct = unknown ? 0 : Math.max(0, Math.min(1, progress ?? 0));
  return (
    <View testID={testID} style={{
      backgroundColor: theme.card, borderRadius: radius.card,
      paddingVertical: space.s3, paddingHorizontal: space.s4, gap: space.s2,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.label }}>{label}</Text>
        <Text testID={testID ? `${testID}-value` : undefined}
          style={{ fontSize: t.subhead.size, fontWeight: '700', color: theme.label }}>{value}</Text>
      </View>
      <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: theme.separator, overflow: 'hidden' }}>
        <View style={{
          width: `${pct * 100}%`, height: '100%', borderRadius: radius.pill,
          backgroundColor: theme.successGraphic,
        }} />
      </View>
      {caption !== undefined && (
        <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{caption}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header streak chip + water row (IA 0001)
// ---------------------------------------------------------------------------

/**
 * The streak, demoted from a card to a chip.
 *
 * Only MyFitnessPal and Cal AI put streaks on the home screen — the two most
 * gamified apps in the category, and MFP is the one whose home-screen rewrite
 * cost it 1.7 stars. The chip keeps the motivation without letting it compete
 * with the day's actual numbers. Tapping it goes to Progress, where the run
 * is explained in full.
 */
export function StreakChip({ theme, days, restDays = 0, onPress, testID }: {
  theme: Theme; days: number; restDays?: number; onPress?: (() => void) | undefined; testID?: string;
}) {
  if (days <= 0) return null;
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: theme.softOrangeBg, borderRadius: radius.pill,
        paddingVertical: 3, paddingHorizontal: space.s2,
      }, pressedStyle(pressed)]}>
      <FlameIcon color={theme.macroProtein} size={13} />
      <Text style={{ fontSize: t.caption.size, fontWeight: '700', color: theme.label }}>
        {days}{restDays > 0 ? '*' : ''}
      </Text>
    </Pressable>
  );
}

/**
 * Water as a single slim row rather than a card.
 *
 * It stays on Today because it is a daily ACTION, not a statistic — the whole
 * value is that adding a glass costs one tap without leaving the screen.
 * Long-press undoes, same contract as the old card.
 */
export function WaterRow({ theme, litres, goalLitres, addLabel, label, onAdd, onUndo, testID }: {
  theme: Theme; litres: number; goalLitres: number; addLabel: string; label: string;
  onAdd: () => void; onUndo: () => void; testID?: string;
}) {
  const pct = goalLitres > 0 ? Math.max(0, Math.min(1, litres / goalLitres)) : 0;
  return (
    <Pressable testID={testID} onPress={onAdd} onLongPress={onUndo}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: space.s3,
        backgroundColor: theme.card, borderRadius: radius.card,
        paddingVertical: space.s3, paddingHorizontal: space.s4,
      }, pressedStyle(pressed)]}>
      <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.label }}>{label}</Text>
      <View style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: theme.separator, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: theme.water }} />
      </View>
      <Text testID={testID ? `${testID}-value` : undefined}
        style={{ fontSize: t.subhead.size, fontWeight: '700', color: theme.label }}>
        {litres} / {goalLitres} L
      </Text>
      <Text style={{ fontSize: t.subhead.size, fontWeight: '700', color: theme.tint }}>{addLabel}</Text>
    </Pressable>
  );
}
