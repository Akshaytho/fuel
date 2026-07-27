import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';

export interface CardProps {
  theme: Theme;
  header?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ theme, header, children, style }: CardProps) {
  return (
    <View style={{ gap: space.s2 }}>
      {header !== undefined && (
        <Text style={{
          fontSize: t.footnote.size, fontWeight: '600',
          color: theme.secondaryLabel, textTransform: 'uppercase',
          letterSpacing: 0.5, paddingHorizontal: space.s2,
        }}>{header}</Text>
      )}
      <View style={{
        backgroundColor: theme.card, borderRadius: radius.card,
        paddingHorizontal: space.s4, paddingVertical: space.s2,
        ...style,
      }}>
        {children}
      </View>
    </View>
  );
}
