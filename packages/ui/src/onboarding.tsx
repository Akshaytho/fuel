import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Theme, space, radius, type as t } from '@fuel/tokens';

/** Segmented progress bar across onboarding steps. */
export function StepBar({ theme, step, total = 4 }: { theme: Theme; step: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.s2 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: i < step ? theme.tint : theme.separator }} />
      ))}
    </View>
  );
}

/** Sex selector per design (Female/Male/Other pill segmented). */
export function Segmented({ theme, options, value, onChange }: {
  theme: Theme; options: readonly string[]; value: number; onChange: (i: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.separator, borderRadius: radius.md, padding: 3 }}>
      {options.map((o, i) => (
        <Pressable key={o} testID={`seg-${i}`} onPress={() => onChange(i)} style={{
          flex: 1, alignItems: 'center', paddingVertical: space.s2,
          backgroundColor: i === value ? theme.card : 'transparent', borderRadius: radius.md - 3,
        }}>
          <Text style={{ fontSize: t.subhead.size, fontWeight: i === value ? '700' : '400', color: theme.label }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CheckCircle({ theme, on }: { theme: Theme; on: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill={on ? theme.tint : 'none'} stroke={on ? theme.tint : theme.separator} strokeWidth="2" />
      {on && <Path d="M7.5 12.5 L10.5 15.5 L16.5 9" stroke={theme.onTint} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
  );
}

/** Goal option card (title + subtitle + check, blue outline when selected). */
export function OptionCard({ theme, title, subtitle, selected, onPress, testID }: {
  theme: Theme; title: string; subtitle: string; selected: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: space.s3,
      backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4,
      borderWidth: 2, borderColor: selected ? theme.tint : 'transparent',
    }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{title}</Text>
        <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{subtitle}</Text>
      </View>
      <CheckCircle theme={theme} on={selected} />
    </Pressable>
  );
}

/** Activity radio row (subtitled, tinted when selected). */
export function RadioRow({ theme, title, subtitle, selected, onPress, testID, divider = true }: {
  theme: Theme; title: string; subtitle: string; selected: boolean; onPress: () => void; testID?: string; divider?: boolean;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: space.s3,
      paddingVertical: space.s3, paddingHorizontal: space.s4,
      backgroundColor: selected ? theme.softBlueBg : theme.card,
      borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.separator,
    }}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: t.body.size, fontWeight: '600', color: theme.label }}>{title}</Text>
        <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{subtitle}</Text>
      </View>
      <CheckCircle theme={theme} on={selected} />
    </Pressable>
  );
}

/** Numeric field row: label left, value + unit right (blue), editable. */
export function FieldRow({ theme, label, value, unit, onChange, testID, divider = true }: {
  theme: Theme; label: string; value: string; unit: string; onChange: (v: string) => void; testID?: string; divider?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: space.s3, paddingHorizontal: space.s4,
      backgroundColor: theme.card, borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.separator,
    }}>
      <Text style={{ flex: 1, fontSize: t.body.size, fontWeight: '600', color: theme.label }}>{label}</Text>
      <TextInput
        testID={testID} value={value} onChangeText={onChange}
        keyboardType="numeric" inputMode="decimal"
        style={{ fontSize: t.body.size, fontWeight: '600', color: theme.tint, textAlign: 'right', minWidth: 56, paddingVertical: 0 }}
      />
      <Text style={{ fontSize: t.body.size, color: theme.tint, marginLeft: 4 }}>{unit}</Text>
    </View>
  );
}

/** Settings-style toggle row (Daily reminder). */
export function ToggleRow({ theme, title, subtitle, value, onChange, testID }: {
  theme: Theme; title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void; testID?: string;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.s3,
      backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4,
    }}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: t.body.size, fontWeight: '600', color: theme.label }}>{title}</Text>
        <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{subtitle}</Text>
      </View>
      <Pressable testID={testID} onPress={() => onChange(!value)} style={{
        width: 50, height: 30, borderRadius: radius.pill, padding: 2,
        backgroundColor: value ? theme.ringCalories : theme.separator,
        alignItems: value ? 'flex-end' : 'flex-start', justifyContent: 'center',
      }}>
        <View style={{ width: 26, height: 26, borderRadius: radius.pill, backgroundColor: theme.onTint }} />
      </Pressable>
    </View>
  );
}

/** The Fuel brand mark — three offset arcs (green/orange/purple). */
export function BrandMark({ theme, size = 88 }: { theme: Theme; size?: number }) {
  const s = size, c = s / 2;
  const arc = (r: number, color: string, dash: number, rot: number, w: number) => (
    <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={w} fill="none"
      strokeLinecap="round" strokeDasharray={`${dash} ${2 * Math.PI * r}`}
      transform={`rotate(${rot} ${c} ${c})`} />
  );
  return (
    <Svg width={s} height={s}>
      {arc(c - 6, theme.ringCalories, 2 * Math.PI * (c - 6) * 0.66, -90, 9)}
      {arc(c - 20, theme.macroProtein, 2 * Math.PI * (c - 20) * 0.55, 30, 9)}
      {arc(c - 32, theme.macroCarbs, 2 * Math.PI * (c - 32) * 0.5, 150, 8)}
    </Svg>
  );
}
