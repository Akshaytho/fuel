import React from 'react';
import { View, Text } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';

export interface MacroTileProps {
  theme: Theme;
  label: string;          // e.g. "Protein" (i18n happens at the screen level)
  consumed_g: number;
  target_g: number;
  color: string;          // theme.macroProtein / macroCarbs / macroFat
}

export function MacroTile({ theme, label, consumed_g, target_g, color }: MacroTileProps) {
  const p = target_g > 0 ? consumed_g / target_g : consumed_g > 0 ? 1 : 0;
  const over = p > 1;
  const width = `${Math.min(p, 1) * 100}%` as const;

  return (
    <View style={{ flex: 1, gap: space.s1 }}>
      <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>
        {label}
      </Text>
      <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.label }}>
        {Math.round(consumed_g)}<Text style={{ color: theme.secondaryLabel, fontWeight: '400' }}> / {Math.round(target_g)}g</Text>
      </Text>
      <View style={{
        height: 4, borderRadius: radius.pill, backgroundColor: theme.separator,
        overflow: 'hidden',
      }}>
        <View style={{
          height: 4, borderRadius: radius.pill, width,
          backgroundColor: over ? theme.danger : color,
        }} />
      </View>
    </View>
  );
}
