import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import { Card, TabBar, FlameIcon } from '@fuel/ui';
import type { Targets, Goal } from '@fuel/domain';
import { pf } from './profileStrings';

/** "You" tab per design (spec 0008) + compliance Delete row. */

export interface ProfileVM {
  name: string;
  sinceLabel: string;          // "Fueling since July 2026 · 3 days logged"
  goal: Goal;
  targets: Targets;
  reminderLabel: string;       // "9:00 PM"
  unitsLabel: string;          // "kg, ml"
}

export interface ProfileScreenProps {
  theme: Theme;
  vm: ProfileVM;
  onChangeGoal: () => void;
  onReminders: () => void;     // TODO(stub): P3 notifications
  onUnits: () => void;         // TODO(stub): units settings
  onHealth: () => void;        // TODO(stub): P2+ Apple Health
  onExport: () => void;
  onHelp: () => void;          // TODO(stub): backlog
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onTab: (i: number) => void;
  onLog: () => void;
}

function IconSq({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 34, height: 34, borderRadius: radius.sm + 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

function Row({ theme, icon, title, trailing, danger, onPress, testID, divider = true, toggle }: {
  theme: Theme; icon?: React.ReactNode; title: string; trailing?: string;
  danger?: boolean; onPress: () => void; testID?: string; divider?: boolean; toggle?: boolean;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: space.s3,
      paddingVertical: space.s3, borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.separator,
    }}>
      {icon}
      <Text style={{ flex: 1, fontSize: t.body.size, fontWeight: '600', color: danger ? theme.danger : theme.label }}>
        {title}
      </Text>
      {toggle ? (
        <View style={{ width: 46, height: 28, borderRadius: radius.pill, backgroundColor: theme.ringCalories, padding: 2, alignItems: 'flex-end' }}>
          <View style={{ width: 24, height: 24, borderRadius: radius.pill, backgroundColor: theme.onTint }} />
        </View>
      ) : trailing !== undefined ? (
        <Text style={{ fontSize: t.body.size, color: theme.secondaryLabel }}>{trailing} ›</Text>
      ) : (
        <Text style={{ fontSize: t.body.size, color: theme.secondaryLabel }}>›</Text>
      )}
    </Pressable>
  );
}

export function ProfileScreen(p: ProfileScreenProps) {
  const { theme, vm } = p;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.s4, paddingTop: space.s10, paddingBottom: 120, gap: space.s4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: theme.avatarBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: t.title2.size, fontWeight: '700', color: theme.onTint }}>
              {vm.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: t.title2.size + 4, fontWeight: '700', color: theme.label }}>{vm.name}</Text>
            <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{vm.sinceLabel}</Text>
          </View>
        </View>

        <Card theme={theme}>
          <View style={{ paddingVertical: space.s2, gap: 2 }}>
            <Text style={{ fontSize: t.footnote.size, fontWeight: '600', letterSpacing: 0.8, color: theme.secondaryLabel }}>{pf.currentGoal}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: t.title2.size, fontWeight: '700', color: theme.label }}>{pf.goalTitle(vm.goal)}</Text>
              <Pressable testID="change-goal" onPress={p.onChangeGoal}>
                <Text style={{ fontSize: t.body.size, fontWeight: '700', color: theme.tint }}>{pf.change}</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>
              {`${vm.targets.kcal.toLocaleString('en-US')} kcal · ${Math.round(vm.targets.protein_g)} g protein · ${pf.adapts}`}
            </Text>
          </View>
        </Card>

        <Card theme={theme}>
          <Row theme={theme} testID="row-reminders" onPress={p.onReminders} trailing={vm.reminderLabel}
            icon={<IconSq bg={theme.softOrangeBg}><FlameIcon color={theme.macroProtein} size={18} /></IconSq>} title={pf.reminders} />
          <Row theme={theme} testID="row-units" onPress={p.onUnits} trailing={vm.unitsLabel}
            icon={<IconSq bg={theme.softBlueBg}><Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M12 5 V19 M5 12 H19" stroke={theme.tint} strokeWidth="2.5" strokeLinecap="round" /></Svg></IconSq>} title={pf.units} />
          <Row theme={theme} testID="row-health" onPress={p.onHealth} toggle
            icon={<IconSq bg="#FDEBEE"><Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M12 20 C6 15.5 3.5 12 3.5 8.8 C3.5 6.2 5.5 4.5 7.8 4.5 C9.4 4.5 11 5.4 12 7 C13 5.4 14.6 4.5 16.2 4.5 C18.5 4.5 20.5 6.2 20.5 8.8 C20.5 12 18 15.5 12 20 Z" stroke={theme.danger} strokeWidth="2" fill="none" /></Svg></IconSq>} title={pf.health} />
          <Row theme={theme} testID="row-export" onPress={p.onExport} trailing="CSV" divider={false}
            icon={<IconSq bg={theme.softPurpleBg}><Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M12 4 V14 M8 10.5 L12 14.5 L16 10.5 M5 19 H19" stroke={theme.macroCarbs} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg></IconSq>} title={pf.export} />
        </Card>

        <Card theme={theme}>
          <Row theme={theme} testID="row-help" onPress={p.onHelp} title={pf.help} />
          <Row theme={theme} testID="row-signout" onPress={p.onSignOut} title={pf.signOut} danger divider={false} trailing="" />
        </Card>

        {/* Compliance addition (spec 0008): erasure — not in original design */}
        <Card theme={theme}>
          <Row theme={theme} testID="row-delete" onPress={p.onDeleteAccount} title={pf.deleteAccount} danger divider={false} trailing="" />
        </Card>

        <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel, textAlign: 'center' }}>{pf.footer}</Text>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <TabBar theme={theme} activeIndex={3} onTab={p.onTab} onLog={p.onLog} soonIndices={[]} />
      </View>
    </View>
  );
}
