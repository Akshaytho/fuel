import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Theme, space, type as t } from '@fuel/tokens';

export interface ListRowProps {
  theme: Theme;
  title: string;
  subtitle?: string;      // e.g. "150 g · scanned"
  trailing?: string;      // e.g. "22g"
  trailingColor?: string; // production design: protein grams in orange
  divider?: boolean;
  /** long-press affordance (e.g. delete a mislogged entry) */
  onLongPress?: (() => void) | undefined;
  testID?: string | undefined;
}

export function ListRow({ theme, title, subtitle, trailing, trailingColor, divider = true, onLongPress, testID }: ListRowProps) {
  return (
    <Pressable testID={testID} onLongPress={onLongPress} delayLongPress={450} style={({ pressed }) => ({
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: space.s3, gap: space.s3,
      borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.separator,
      opacity: pressed && onLongPress ? 0.6 : 1,
    })}>
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
        <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: trailingColor ?? theme.label }}>
          {trailing}
        </Text>
      )}
    </Pressable>
  );
}
