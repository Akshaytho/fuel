import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Theme, space, radius, type as t } from '@fuel/tokens';

/** Production bottom bar: Today · Trends · [big +] · Report · You. */
export interface TabBarProps {
  theme: Theme;
  activeIndex: number;          // 0..3 across the four tabs
  onTab: (index: number) => void;
  onLog: () => void;
}

function Icon({ name, color }: { name: string; color: string }) {
  const s = 24;
  switch (name) {
    case 'today':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="2" fill="none" />
          <Circle cx="12" cy="12" r="3.5" fill={color} />
        </Svg>
      );
    case 'trends':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M3 16 L9 10 L13 13 L21 5" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'report':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Rect x="4" y="4" width="16" height="16" rx="4" stroke={color} strokeWidth="2" fill="none" />
          <Path d="M8 14 L11 11 L13 13 L16 9" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default: // you
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Circle cx="12" cy="8.5" r="3.5" stroke={color} strokeWidth="2" fill="none" />
          <Path d="M5.5 19.5 C6.5 15.5 9 14 12 14 C15 14 17.5 15.5 18.5 19.5" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
        </Svg>
      );
  }
}

export function TabBar({ theme, activeIndex, onTab, onLog }: TabBarProps) {
  const tabs = [
    { name: 'today', label: 'Today' },
    { name: 'trends', label: 'Trends' },
    { name: 'report', label: 'Report' },
    { name: 'you', label: 'You' },
  ];
  const item = (i: number) => {
    const active = activeIndex === i;
    const color = active ? theme.tint : theme.secondaryLabel;
    return (
      <Pressable key={tabs[i]!.name} onPress={() => onTab(i)}
        style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: space.s2 }}>
        <Icon name={tabs[i]!.name} color={color} />
        <Text style={{ fontSize: t.caption.size, fontWeight: active ? '600' : '500', color }}>
          {tabs[i]!.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start',
      backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.separator,
      paddingBottom: space.s4, minHeight: 74,
    }}>
      {item(0)}
      {item(1)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable onPress={onLog} style={{
          width: 56, height: 56, borderRadius: radius.pill, backgroundColor: theme.tint,
          alignItems: 'center', justifyContent: 'center', marginTop: -space.s4,
          shadowColor: theme.shadow, shadowOpacity: 0.25, shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 }, elevation: 8,
        }}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path d="M12 5 V19 M5 12 H19" stroke={theme.onTint} strokeWidth="2.5" strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>
      {item(2)}
      {item(3)}
    </View>
  );
}
