import React from 'react';
import { View, Text } from 'react-native';
import { Theme, space, type as t } from '@fuel/tokens';

export interface ListRowProps {
  theme: Theme;
  title: string;
  subtitle?: string;      // e.g. "150 g · scanned"
  trailing?: string;      // e.g. "248 kcal"
  divider?: boolean;
}

export function ListRow({ theme, title, subtitle, trailing, divider = true }: ListRowProps) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: space.s3, gap: space.s3,
      borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.separator,
    }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={{
          fontSize: t.body.size, color: theme.label,
        }}>{title}</Text>
        {subtitle !== undefined && (
          <Text numberOfLines={1} style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing !== undefined && (
        <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.label }}>
          {trailing}
        </Text>
      )}
    </View>
  );
}
