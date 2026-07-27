import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';

export interface NavPillProps {
  theme: Theme;
  tabs: readonly string[];        // labels; icons arrive with real assets
  activeIndex: number;
  onTab?: (index: number) => void;
  logLabel?: string;              // the big log button, e.g. "+"
  onLog?: () => void;             // required behavior: never a dead control —
                                  // screens must pass this (CLAUDE.md rule)
}

export function NavPill({ theme, tabs, activeIndex, onTab, logLabel = '+', onLog }: NavPillProps) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
      backgroundColor: theme.cardElevated, borderRadius: radius.pill,
      paddingHorizontal: space.s2, paddingVertical: space.s2, gap: space.s1,
      shadowColor: theme.shadow, shadowOpacity: 0.12, shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 }, elevation: 8,
    }}>
      {tabs.map((label, i) => (
        <Pressable
          key={label}
          onPress={() => onTab?.(i)}
          style={{
            paddingHorizontal: space.s4, paddingVertical: space.s2,
            borderRadius: radius.pill,
            backgroundColor: i === activeIndex ? theme.bg : 'transparent',
          }}
        >
          <Text style={{
            fontSize: t.subhead.size,
            fontWeight: i === activeIndex ? '600' : '400',
            color: i === activeIndex ? theme.label : theme.secondaryLabel,
          }}>{label}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={onLog}
        style={{
          width: 44, height: 44, borderRadius: radius.pill,
          backgroundColor: theme.tint, alignItems: 'center', justifyContent: 'center',
          marginLeft: space.s1,
        }}
      >
        <Text style={{ fontSize: t.title2.size, fontWeight: '600', color: theme.onTint, lineHeight: t.title2.size + 2 }}>
          {logLabel}
        </Text>
      </Pressable>
    </View>
  );
}
