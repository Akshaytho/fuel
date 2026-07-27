import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';

/** Small stat card (Streak / Water) per production Summary. */
export interface StatCardProps {
  theme: Theme;
  title: string;
  accessory?: React.ReactNode;   // flame emoji text / "+250"
  value: string;
  valueSuffix?: string;
}
export function StatCard({ theme, title, accessory, value, valueSuffix }: StatCardProps) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4, gap: space.s2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{title}</Text>
        {accessory}
      </View>
      <Text numberOfLines={1} style={{ fontSize: t.title2.size, fontWeight: '700', color: theme.label }}>
        {value}
        {valueSuffix !== undefined && (
          <Text style={{ fontSize: t.footnote.size, fontWeight: '400', color: theme.secondaryLabel }}> {valueSuffix}</Text>
        )}
      </Text>
    </View>
  );
}

/** Green coaching strip under the rings. */
export function CoachStrip({ theme, text }: { theme: Theme; text: string }) {
  return (
    <View style={{ backgroundColor: theme.successBg, borderRadius: radius.md, paddingVertical: space.s3, paddingHorizontal: space.s4 }}>
      <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.onSuccessBg }}>{text}</Text>
    </View>
  );
}

/** Empty-state action row: tinted icon square, title, subtitle, chevron. */
export interface ActionRowProps {
  theme: Theme;
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  chevron?: boolean;
  onPress: () => void;
}
export function ActionRow({ theme, iconBg, icon, title, subtitle, chevron = true, onPress }: ActionRowProps) {
  return (
    <Pressable onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: space.s3,
      backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4,
    }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.sm + 2, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{title}</Text>
        <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{subtitle}</Text>
      </View>
      {chevron && <Text style={{ fontSize: t.body.size, color: theme.secondaryLabel }}>{'›'}</Text>}
    </Pressable>
  );
}
