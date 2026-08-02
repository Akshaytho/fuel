import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import { TripleRing, TabBar, StatCard, CoachStrip, ActionRow, ListRow, Card, ScanIcon, ChatIcon, FlameIcon, pressedStyle,
  WeekStrip, ComebackCard, CelebrationOverlay, NutrientStrip, type WeekStripDay, type CoachTone } from '@fuel/ui';
import type { DaySummary, Targets, Comeback, Celebration } from '@fuel/domain';
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
      streak: { current: number; longest: number; isLongest: boolean; loggedToday: boolean;
                restDaysAvailable: number; restedDays: string[] };
      /** B-16: real logged water; liters is the actual sum, never a stub 0 */
      water: { liters: number; goalLiters: number };
      /** the line under the rings — TONE included, because the same words in
          green vs neutral are two different messages (see CoachStrip) */
      coach?: { text: string; tone: CoachTone } | undefined;
      /** 7-dot Monday-first week; answers "how many days did I log this week" */
      week: { days: WeekStripDay[]; summary: string; footnote?: string | undefined };
      /** set when a user with history returns after a gap — replaces first-run copy */
      comeback?: Comeback | undefined;
      /** spec 0013: an earned rest day just covered a missed day */
      restNote?: { title: string; body: string } | undefined;
      /** spec 0015: fibre, with the coverage that produced the number */
      fibre?: { value: string; caption?: string | undefined; progress?: number | undefined; unknown: boolean } | undefined;
      /** design 6a: set on the day this user's targets land, once per day */
      celebration?: Celebration | undefined;
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
  onDismissCelebration: () => void;
  /** the week strip is a shortcut into the fuller picture */
  onOpenTrends: () => void;
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
        <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: theme.onAvatarBg }}>{initial}</Text>
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
  // Colour follows the MEANINGFUL threshold, wording follows the literal fact:
  // 5 kcal over still reads "Calories over 5", but nothing turns red for it.
  const alarm = summary.isMeaningfullyOver;
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
          <StatBlock theme={theme} label={over ? str.calsOver : str.calsLeft} labelColor={alarm ? theme.danger : theme.success}
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

function EmptyNutritionCard({ theme, targets, dayLabel, returning }: {
  theme: Theme; targets: Targets; dayLabel: string; returning: boolean;
}) {
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
            {returning ? str.emptyHeadlineReturning : str.emptyHeadline}
          </Text>
          <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>
            {returning ? str.emptyHintReturning : str.emptyHint}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function TodayScreen({
  theme, vm, onLog, onScan, onDescribe, onTab, onProfile, onAddWater, onUndoWater, onRetrySync, onRemoveEntry,
  onDismissCelebration, onOpenTrends,
}: TodayScreenProps) {
  const hasHistory = vm.kind === 'ready' && (vm.streak.longest > 0 || vm.comeback !== undefined);
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
            <EmptyNutritionCard theme={theme} targets={vm.targets}
              dayLabel={vm.dateLabel.split('· ')[1] ?? ''} returning={hasHistory} />
            {vm.restNote !== undefined && (
              <ComebackCard testID="rest-note" theme={theme}
                title={vm.restNote.title} body={vm.restNote.body} />
            )}
            {vm.comeback !== undefined && (
              <ComebackCard testID="comeback-card" theme={theme}
                title={vm.comeback.title} body={vm.comeback.body} />
            )}
            {hasHistory && (
              <WeekStrip testID="week-summary" theme={theme} days={vm.week.days}
                summary={vm.week.summary} footnote={vm.week.footnote} onPress={onOpenTrends} />
            )}
            <ActionRow theme={theme} iconBg={theme.softBlueBg} onPress={onScan}
              icon={<ScanIcon color={theme.tint} />}
              title={str.scanTitle} subtitle={str.scanSub} />
            <ActionRow theme={theme} iconBg={theme.successBg} onPress={onDescribe}
              icon={<ChatIcon color={theme.success} />}
              title={str.describeTitle} subtitle={str.describeSub} />
            {vm.comeback === undefined && (
              <ActionRow theme={theme} iconBg={theme.softOrangeBg} onPress={onLog} chevron={false}
                icon={<FlameIcon color={theme.macroProtein} />}
                title={vm.streak.current > 0 ? str.streakKeepTitle(vm.streak.current) : str.streakStartTitle}
                subtitle={vm.streak.current > 0 ? str.streakKeepSub : str.streakStartSub} />
            )}
          </>
        ) : (
          <>
            <View style={{ gap: space.s3 }}>
              <NutritionCard theme={theme} targets={vm.targets} summary={vm.summary}
                statusLabel={vm.summary.isMeaningfullyOver ? str.overPace : str.onPace}
                statusColor={vm.summary.isMeaningfullyOver ? theme.danger : theme.success} />
              {vm.coach !== undefined && (
                <CoachStrip testID="coach-strip" theme={theme} text={vm.coach.text} tone={vm.coach.tone} />
              )}
              {vm.restNote !== undefined && (
                <ComebackCard testID="rest-note" theme={theme}
                  title={vm.restNote.title} body={vm.restNote.body} />
              )}
              {vm.fibre !== undefined && (
                <NutrientStrip testID="fibre-strip" theme={theme} label={str.fibre}
                  value={vm.fibre.value} caption={vm.fibre.caption}
                  progress={vm.fibre.progress} unknown={vm.fibre.unknown} />
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: space.s4 }}>
              <StatCard theme={theme} title={str.streak} testID="streak-value"
                accessory={<Text style={{ fontSize: t.subhead.size }}>{vm.streak.loggedToday ? '🔥' : '·'}</Text>}
                value={String(vm.streak.current)}
                valueSuffix={
                  // Precedence matters: on day one current===longest===1, which
                  // read as "1 days · your longest" — grammatically wrong AND a
                  // hollow celebration. Singular first, only brag from day 2.
                  // Rest days outrank the "longest" brag: a run held together
                  // by a rest day must say so before it congratulates anyone.
                  vm.streak.current === 0 ? str.streakStart
                    : vm.streak.current === 1 ? str.day
                    : vm.streak.restedDays.length > 0 ? str.daysWithRest(vm.streak.restedDays.length)
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

            <WeekStrip testID="week-summary" theme={theme} days={vm.week.days}
              summary={vm.week.summary} footnote={vm.week.footnote} onPress={onOpenTrends} />

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

      {vm.kind === 'ready' && vm.celebration !== undefined && (
        <CelebrationOverlay theme={theme} title={vm.celebration.title} body={vm.celebration.body}
          streakLine={vm.celebration.streakLine} onDismiss={onDismissCelebration} />
      )}
    </View>
  );
}
