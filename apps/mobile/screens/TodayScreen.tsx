import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import { TripleRing, TabBar, StatCard, CoachStrip, ActionRow, ListRow, Card, ScanIcon, ChatIcon, FlameIcon, pressedStyle } from '@fuel/ui';
import type { DaySummary, Targets } from '@fuel/domain';
import { str } from './strings';

/** Spec 0004 rev B — matches production "Summary" design (turn-4) exactly. */

export interface EntryVM { id: string; title: string; subtitle: string; proteinLabel: string }

export type TodayVM =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      dateLabel: string;            // "SATURDAY, JULY 26" (caps) — "· DAY n" from real signup date
      /** B-19: distinct states, not one conflated "offline" flag */
      sync: { state: 'synced' | 'pending' | 'offline' | 'failed'; pending: number };
      /** B-18: real initial from the signed-in account, never a hardcoded "A" */
      initial: string;
      targets: Targets;
      summary: DaySummary;
      entries: EntryVM[];           // flat "TODAY'S MEALS" list per design
      /** B-16: computed from real logged days; current 0 = no streak yet */
      streak: { current: number; longest: number; isLongest: boolean; loggedToday: boolean };
      /** B-16: real logged water; liters is the actual sum, never a stub 0 */
      water: { liters: number; goalLiters: number };
      coach?: string | undefined;   // green strip message; omit to hide
    };

export interface TodayScreenProps {
  theme: Theme;
  vm: TodayVM;
  onLog: () => void;
  onScan: () => void;
  onDescribe: () => void;
  onTab: (index: number) => void;
  onProfile: () => void;
  onAddWater: () => void;
  onUndoWater: () => void;
  onRetrySync: () => void;
  /** long-press on a meal row — remove a mislogged entry (with confirm) */
  onRemoveEntry: (id: string) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function Header({ theme, dateLabel, initial, onProfile }: {
  theme: Theme; dateLabel?: string | undefined; initial: string; onProfile: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View style={{ gap: 2 }}>
        {dateLabel !== undefined && (
          <Text style={{ fontSize: t.footnote.size, fontWeight: '600', letterSpacing: 0.8, color: theme.secondaryLabel }}>
            {dateLabel.toUpperCase()}
          </Text>
        )}
        <Text style={{ fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight, color: theme.label }}>
          {str.summary}
        </Text>
      </View>
      <Pressable testID="avatar" onPress={onProfile} style={({ pressed }) => [{
        width: 40, height: 40, borderRadius: radius.pill, backgroundColor: theme.avatarBg,
        alignItems: 'center', justifyContent: 'center',
      }, pressedStyle(pressed)]}>
        <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: theme.onTint }}>{initial}</Text>
      </Pressable>
    </View>
  );
}

function StatBlock({ theme, label, labelColor, big, small }: {
  theme: Theme; label: string; labelColor: string; big: string; small: string;
}) {
  return (
    <View style={{ gap: 1 }}>
      <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: labelColor }}>{label}</Text>
      <Text style={{ fontSize: t.title2.size, fontWeight: '700', color: theme.label }}>
        {big}
        <Text style={{ fontSize: t.subhead.size, fontWeight: '400', color: theme.secondaryLabel }}> {small}</Text>
      </Text>
    </View>
  );
}

function NutritionCard({ theme, targets, summary, statusLabel, statusColor }: {
  theme: Theme; targets: Targets; summary: DaySummary; statusLabel: string; statusColor: string;
}) {
  const left = Math.max(0, summary.remaining.kcal);
  const over = summary.isOver;
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4, gap: space.s4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{str.nutrition}</Text>
        <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s5 }}>
        <TripleRing
          theme={theme}
          calories={summary.progress.kcal}
          protein={summary.progress.protein}
          inner={(summary.progress.carbs + summary.progress.fat) / 2}
        />
        <View style={{ flex: 1, gap: space.s3 }}>
          <StatBlock theme={theme} label={over ? str.calsOver : str.calsLeft} labelColor={over ? theme.danger : theme.success}
            big={fmt(over ? -summary.remaining.kcal : left)} small={str.ofTarget(fmt(targets.kcal))} />
          <StatBlock theme={theme} label={str.protein} labelColor={theme.macroProtein}
            big={fmt(summary.consumed.protein_g)} small={`/${fmt(targets.protein_g)}g`} />
          <StatBlock theme={theme} label={str.carbsFat} labelColor={theme.macroCarbs}
            big={`${fmt(summary.consumed.carbs_g)} · ${fmt(summary.consumed.fat_g)}`} small="g" />
        </View>
      </View>
    </View>
  );
}

function EmptyNutritionCard({ theme, targets, dayLabel }: { theme: Theme; targets: Targets; dayLabel: string }) {
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4, gap: space.s4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{str.nutrition}</Text>
        <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{dayLabel}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s5 }}>
        <TripleRing theme={theme} calories={0} protein={0} inner={0} size={168}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: t.title2.size + 4, fontWeight: '700', color: theme.label }}>{fmt(targets.kcal)}</Text>
            <Text style={{ fontSize: t.caption.size, fontWeight: '600', letterSpacing: 1, color: theme.secondaryLabel }}>{str.toGo}</Text>
          </View>
        </TripleRing>
        <View style={{ flex: 1, gap: space.s2 }}>
          <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>
            {str.emptyHeadline}
          </Text>
          <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{str.emptyHint}</Text>
        </View>
      </View>
    </View>
  );
}

export function TodayScreen({
  theme, vm, onLog, onScan, onDescribe, onTab, onProfile, onAddWater, onUndoWater, onRetrySync, onRemoveEntry,
}: TodayScreenProps) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.s4, paddingBottom: 120, gap: space.s4 }}>
        <Header theme={theme} dateLabel={vm.kind === 'ready' ? vm.dateLabel : undefined}
          initial={vm.kind === 'ready' ? vm.initial : '·'} onProfile={onProfile} />

        {vm.kind === 'ready' && vm.sync.state !== 'synced' && (
          <Pressable testID="sync-pill" disabled={vm.sync.state !== 'failed'} onPress={onRetrySync}
            style={({ pressed }) => [{
              backgroundColor: theme.cardElevated, borderRadius: radius.md,
              paddingVertical: space.s2, paddingHorizontal: space.s3, alignSelf: 'flex-start',
            }, pressedStyle(pressed)]}>
            <Text style={{
              fontSize: t.footnote.size,
              color: vm.sync.state === 'failed' ? theme.danger : theme.secondaryLabel,
            }}>
              {vm.sync.state === 'offline' ? str.offline
                : vm.sync.state === 'failed' ? str.syncFailed
                : str.unsynced(vm.sync.pending)}
            </Text>
          </Pressable>
        )}

        {vm.kind === 'loading' ? (
          <View style={{ gap: space.s4 }}>
            <View style={{ height: 268, borderRadius: radius.card, backgroundColor: theme.separator }} />
            <View style={{ flexDirection: 'row', gap: space.s4 }}>
              <View style={{ flex: 1, height: 108, borderRadius: radius.card, backgroundColor: theme.separator }} />
              <View style={{ flex: 1, height: 108, borderRadius: radius.card, backgroundColor: theme.separator }} />
            </View>
            <View style={{ height: 220, borderRadius: radius.card, backgroundColor: theme.separator }} />
          </View>
        ) : vm.entries.length === 0 ? (
          <>
            <EmptyNutritionCard theme={theme} targets={vm.targets} dayLabel={vm.dateLabel.split('· ')[1] ?? ''} />
            <ActionRow theme={theme} iconBg={theme.softBlueBg} onPress={onScan}
              icon={<ScanIcon color={theme.tint} />}
              title={str.scanTitle} subtitle={str.scanSub} />
            <ActionRow theme={theme} iconBg={theme.successBg} onPress={onDescribe}
              icon={<ChatIcon color={theme.success} />}
              title={str.describeTitle} subtitle={str.describeSub} />
            <ActionRow theme={theme} iconBg={theme.softOrangeBg} onPress={onLog} chevron={false}
              icon={<FlameIcon color={theme.macroProtein} />}
              title={str.streakStartTitle} subtitle={str.streakStartSub} />
          </>
        ) : (
          <>
            <View style={{ gap: space.s3 }}>
              <NutritionCard theme={theme} targets={vm.targets} summary={vm.summary}
                statusLabel={vm.summary.isOver ? str.overPace : str.onPace}
                statusColor={vm.summary.isOver ? theme.danger : theme.success} />
              {vm.coach !== undefined && <CoachStrip theme={theme} text={vm.coach} />}
            </View>

            <View style={{ flexDirection: 'row', gap: space.s4 }}>
              <StatCard theme={theme} title={str.streak} testID="streak-value"
                accessory={<Text style={{ fontSize: t.subhead.size }}>{vm.streak.loggedToday ? '🔥' : '·'}</Text>}
                value={String(vm.streak.current)}
                valueSuffix={
                  // Precedence matters: on day one current===longest===1, which
                  // read as "1 days · your longest" — grammatically wrong AND a
                  // hollow celebration. Singular first, only brag from day 2.
                  vm.streak.current === 0 ? str.streakStart
                    : vm.streak.current === 1 ? str.day
                    : vm.streak.isLongest ? str.daysLongest
                    : str.days
                } />
              <Pressable testID="water-add" onPress={onAddWater}
                onLongPress={onUndoWater}
                style={({ pressed }) => [{ flex: 1 }, pressedStyle(pressed)]}>
                <StatCard theme={theme} title={str.water} testID="water-value"
                  accessory={<Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.water }}>{str.waterAdd}</Text>}
                  value={String(vm.water.liters)}
                  valueSuffix={`/ ${vm.water.goalLiters} L`} />
              </Pressable>
            </View>

            <View style={{ gap: space.s2 }}>
              <Text style={{ fontSize: t.footnote.size, fontWeight: '600', letterSpacing: 0.8, color: theme.secondaryLabel }}>
                {str.todaysMeals}
              </Text>
              <Card theme={theme}>
                {vm.entries.map((e, i) => (
                  <ListRow key={e.id} theme={theme} title={e.title} subtitle={e.subtitle}
                    trailing={e.proteinLabel} trailingColor={theme.macroProtein}
                    testID={`entry-${e.id}`} onLongPress={() => onRemoveEntry(e.id)}
                    divider={i < vm.entries.length - 1} />
                ))}
              </Card>
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <TabBar theme={theme} activeIndex={0} onTab={onTab} onLog={onLog} soonIndices={[]} />
      </View>
    </View>
  );
}
