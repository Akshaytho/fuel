import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import { pressedStyle } from './motion';

/** Bottom-sheet container with grabber, per Log/Portion sheet designs. */
export function Sheet({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: theme.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.s4, paddingBottom: space.s6, paddingTop: space.s2,
      shadowColor: theme.shadow, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -8 },
    }}>
      <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radius.pill, backgroundColor: theme.separator, marginBottom: space.s3 }} />
      {children}
    </View>
  );
}

export function SearchField({ theme, value, placeholder, onChange, onFocus, editable = true, onCancel }: {
  theme: Theme; value?: string; placeholder: string; onChange?: (v: string) => void;
  onFocus?: () => void; editable?: boolean; onCancel?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s2,
        backgroundColor: theme.separator, borderRadius: radius.md, paddingHorizontal: space.s3, height: 40,
      }}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Circle cx="10.5" cy="10.5" r="6.5" stroke={theme.secondaryLabel} strokeWidth="2.4" fill="none" />
          <Path d="M15.5 15.5 L21 21" stroke={theme.secondaryLabel} strokeWidth="2.4" strokeLinecap="round" />
        </Svg>
        <TextInput
          value={value} placeholder={placeholder} placeholderTextColor={theme.secondaryLabel}
          onChangeText={onChange} onFocus={onFocus} editable={editable}
          autoCorrect={false} autoCapitalize="none"
          style={{ flex: 1, fontSize: t.body.size, color: theme.label, paddingVertical: 0 }}
        />
      </View>
      {onCancel && (
        <Pressable onPress={onCancel}><Text style={{ fontSize: t.body.size, color: theme.tint }}>Cancel</Text></Pressable>
      )}
    </View>
  );
}

/** Tinted action tile (Scan/Describe/Label/Saved). */
export function IconTile({ theme, label, tint, bg, icon, onPress }: {
  theme: Theme; label: string; tint: string; bg: string; icon: React.ReactNode; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{
      flex: 1, alignItems: 'center', gap: space.s2, backgroundColor: theme.card,
      borderRadius: radius.card, paddingVertical: space.s4,
    }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.sm + 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ fontSize: t.footnote.size, fontWeight: '600', color: theme.label }}>{label}</Text>
    </Pressable>
  );
}

/** Food row with one-tap + (go-tos and search results). */
export function FoodRow({ theme, title, titleNode, subtitle, onAdd, divider = true, addTestID }: {
  theme: Theme; title?: string; titleNode?: React.ReactNode; subtitle: string; onAdd: () => void; divider?: boolean; addTestID?: string;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3,
      borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.separator,
    }}>
      <View style={{ flex: 1, gap: 2 }}>
        {titleNode ?? (
          <Text numberOfLines={1} style={{ fontSize: t.body.size, fontWeight: '600', color: theme.label }}>{title}</Text>
        )}
        <Text numberOfLines={1} style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{subtitle}</Text>
      </View>
      <Pressable testID={addTestID} onPress={onAdd} style={{
        width: 32, height: 32, borderRadius: radius.pill, backgroundColor: theme.softBlueBg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d="M12 5 V19 M5 12 H19" stroke={theme.tint} strokeWidth="2.5" strokeLinecap="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

/** Selectable chip (portion sizes, meals). */
export function SelectChip({ theme, label, selected, tintedBg, tintedColor, onPress, compact, testID }: {
  theme: Theme; label: string; selected: boolean; tintedBg?: string | undefined; tintedColor?: string | undefined; onPress: () => void; compact?: boolean; testID?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{
      paddingHorizontal: compact ? space.s3 : space.s4, paddingVertical: space.s2 + 2, borderRadius: radius.md,
      backgroundColor: selected ? theme.card : tintedBg ?? theme.card,
      borderWidth: selected ? 2 : 1,
      borderColor: selected ? theme.tint : theme.separator,
    }}>
      <Text style={{
        fontSize: t.subhead.size, fontWeight: '600',
        color: selected ? theme.tint : tintedColor ?? theme.label,
      }}>{label}</Text>
    </Pressable>
  );
}

/** Macro preview tile on the portion sheet (KCAL/PROTEIN/CARBS/FAT). */
export function MacroPreviewTile({ theme, value, label, color }: {
  theme: Theme; value: string; label: string; color?: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: radius.md, alignItems: 'center', paddingVertical: space.s3, gap: 2 }}>
      <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: color ?? theme.label }}>{value}</Text>
      <Text style={{ fontSize: t.caption.size - 1, fontWeight: '600', letterSpacing: 0.5, color: theme.secondaryLabel }}>{label}</Text>
    </View>
  );
}

export function CTAButton({ theme, label, onPress, testID }: { theme: Theme; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [{
      backgroundColor: theme.tint, borderRadius: radius.card, alignItems: 'center', paddingVertical: space.s4,
    }, pressedStyle(pressed)]}>
      <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: theme.onTint }}>{label}</Text>
    </Pressable>
  );
}
