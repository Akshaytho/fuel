import React from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import { TripleRing, TabBar, CoachStrip, ActionRow, ListRow, Card, ScanIcon, ChatIcon, FlameIcon,
  pressedStyle, ComebackCard, CelebrationOverlay, StreakChip, WaterRow, Sheet, CTAButton,
  type CoachTone } from '@fuel/ui';
import type { DaySummary, Targets, Celebration } from '@fuel/domain';
import { str } from './strings';

/**
 * Spec 0004 rev C — Today, rebuilt to the information architecture in
 * docs/research/0003.
 *
 * Today answers exactly one question: HOW AM I DOING RIGHT NOW. It holds at
 * most five blocks, and a new feature does not get added here — it displaces
 * something or it lives on another screen.
 *
 *   1. Header — date, Day N, streak chip, avatar
 *   2. Nutrition card — the hero, tappable for the full breakdown
 *   3. ONE moment — coach line, comeback, or rest-day note. Never two.
 *   4. Water — a slim row, because it is a daily ACTION not a statistic
 *   5. TODAY'S MEALS — the diary, and it never moves further away
 *
 * The last rule is the important one. MyFitnessPal's 2026 rewrite buried the
 * diary behind a "View All" button and its version rating fell 3.24 → 1.54.
 */

export interface EntryVM { id: string; title: string; subtitle: string; proteinLabel: string }

/** At most ONE of these renders. Modelling it as a union rather than three
    optional fields makes "never two banners" a type guarantee, not a habit. */
export type Moment =
  | { kind: 'coach'; text: string; tone: CoachTone }
  | { kind: 'note'; title: string; body: string; testID: string };

export interface FibreVM {
  value: string;
  caption?: string | undefined;
  progress?: number | undefined;
  unknown: boolean;
}

export type TodayVM =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      dateLabel: string;            // "SATURDAY, JULY 26 · DAY n"
      /** B-19: distinct states, not one conflated "offline" flag */
      sync: { state: 'synced' | 'pending' | 'offline' | 'failed'; pending: number };
      /** B-18: real initial from the signed-in account, never a hardcoded "A" */
      initial: string;
      targets: Targets;
      summary: DaySummary;
      entries: EntryVM[];
      /** B-16: computed from real logged days; current 0 = no streak yet */
      streak: { current: number; longest: number; isLongest: boolean; loggedToday: boolean;
                restDaysAvailable: number; restedDays: string[] };
      water: { liters: number; goalLiters: number };
      /** the single moment slot */
      moment?: Moment | undefined;
      /** spec 0015 — lives in the detail sheet, NOT on the surface */
      fibre?: FibreVM | undefined;
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
  /** the streak chip is a shortcut into the fuller picture */
  onOpenProgress: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function Header({ theme, dateLabel, initial, streak, onProfile, onOpenProgress }: {
  theme: Theme; dateLabel?: string | undefined; initial: string;
  streak?: { current: number; restedDays: string[] } | undefined;
  onProfile: () => void; onOpenProgress: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View style={{ gap: 2 }}>
        {dateLabel !== undefined && (
          <Text style={{ fontSize: t.footnote.size, fontWeight: '600', letterSpacing: 0.8, color: theme.secondaryLabel }}>
            {dateLabel.toUpperCase()}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
          <Text style={{ fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight, color: theme.label }}>
            {str.summary}
          </Text>
          {streak !== undefined && (
            <StreakChip testID="streak-chip" theme={theme} days={streak.current}
              restDays={streak.restedDays.length} onPress={onOpenProgress} />
          )}
        </View>
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

function NutritionCard({ theme, targets, summary, onOpenDetail }: {
  theme: Theme; targets: Targets; summary: DaySummary; onOpenDetail: () => void;
}) {
  const left = Math.max(0, summary.remaining.kcal);
  const over = summary.isOver;
  // Colour follows the MEANINGFUL threshold, wording follows the literal fact:
  // 5 kcal over still reads "Calories over 5", but nothing turns red for it.
  const alarm = summary.isMeaningfullyOver;
  return (
    <Pressable testID="nutrition-card" onPress={onOpenDetail} style={({ pressed }) => [{
      backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4, gap: space.s4,
    }, pressedStyle(pressed)]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{str.nutrition}</Text>
        <Text testID="nutrition-detail-link"
          style={{ fontSize: t.subhead.size, fontWeight: '600', color: alarm ? theme.danger : theme.tint }}>
          {alarm ? str.overPace : str.detail}
        </Text>
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
    </Pressable>
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

/** One moment slot. Exactly one thing, or nothing. */
function MomentSlot({ theme, moment }: { theme: Theme; moment: Moment }) {
  if (moment.kind === 'coach') {
    return <CoachStrip testID="coach-strip" theme={theme} text={moment.text} tone={moment.tone} />;
  }
  return <ComebackCard testID={moment.testID} theme={theme} title={moment.title} body={moment.body} />;
}

function DetailRow({ theme, label, value, progress, color }: {
  theme: Theme; label: string; value: string; progress: number; color: string;
}) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ gap: space.s2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.label }}>{label}</Text>
        <Text style={{ fontSize: t.subhead.size, fontWeight: '700', color: theme.label }}>{value}</Text>
      </View>
      <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: theme.separator, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: color }} />
      </View>
    </View>
  );
}

/**
 * The full breakdown, one tap from the card. This is where fibre lives —
 * every app in the field keeps micronutrients off the home screen, and putting
 * fibre beside calories would tell the user they rank equally, which is false.
 */
function DetailSheet({ theme, targets, summary, fibre, onClose }: {
  theme: Theme; targets: Targets; summary: DaySummary; fibre?: FibreVM | undefined; onClose: () => void;
}) {
  return (
    <Sheet theme={theme}>
      <View style={{ gap: space.s4 }}>
        <Text style={{ fontSize: t.title2.size, fontWeight: '700', color: theme.label }}>{str.detailTitle}</Text>
        <DetailRow theme={theme} label={str.calories}
          value={`${fmt(summary.consumed.kcal)} of ${fmt(targets.kcal)}`}
          progress={summary.progress.kcal} color={theme.success} />
        <DetailRow theme={theme} label={str.protein}
          value={`${fmt(summary.consumed.protein_g)} g of ${fmt(targets.protein_g)} g`}
          progress={summary.progress.protein} color={theme.macroProtein} />
        <DetailRow theme={theme} label={str.carbs}
          value={`${fmt(summary.consumed.carbs_g)} g of ${fmt(targets.carbs_g)} g`}
          progress={summary.progress.carbs} color={theme.macroCarbs} />
        <DetailRow theme={theme} label={str.fat}
          value={`${fmt(summary.consumed.fat_g)} g of ${fmt(targets.fat_g)} g`}
          progress={summary.progress.fat} color={theme.macroFat} />
        {fibre !== undefined && (
          <View testID="fibre-detail" style={{ gap: space.s2, borderTopWidth: 1, borderTopColor: theme.separator, paddingTop: space.s4 }}>
            <DetailRow theme={theme} label={str.fibre} value={fibre.value}
              progress={fibre.unknown ? 0 : fibre.progress ?? 0} color={theme.successGraphic} />
            {fibre.caption !== undefined && (
              <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{fibre.caption}</Text>
            )}
          </View>
        )}
        <CTAButton theme={theme} label={str.detailClose} testID="detail-close" onPress={onClose} />
      </View>
    </Sheet>
  );
}

export function TodayScreen({
  theme, vm, onLog, onScan, onDescribe, onTab, onProfile, onAddWater, onUndoWater, onRetrySync, onRemoveEntry,
  onDismissCelebration, onOpenProgress,
}: TodayScreenProps) {
  const [detailOpen, setDetailOpen] = React.useState(false);
  const hasHistory = vm.kind === 'ready' && vm.streak.longest > 0;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.s4, paddingBottom: 120, gap: space.s4 }}>
        <Header theme={theme} dateLabel={vm.kind === 'ready' ? vm.dateLabel : undefined}
          initial={vm.kind === 'ready' ? vm.initial : '·'}
          streak={vm.kind === 'ready' ? vm.streak : undefined}
          onProfile={onProfile} onOpenProgress={onOpenProgress} />

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
            <View style={{ height: 48, borderRadius: radius.card, backgroundColor: theme.separator }} />
            <View style={{ height: 220, borderRadius: radius.card, backgroundColor: theme.separator }} />
          </View>
        ) : vm.entries.length === 0 ? (
          <>
            <EmptyNutritionCard theme={theme} targets={vm.targets}
              dayLabel={vm.dateLabel.split('· ')[1] ?? ''} returning={hasHistory} />
            {vm.moment !== undefined && <MomentSlot theme={theme} moment={vm.moment} />}
            <ActionRow theme={theme} iconBg={theme.softBlueBg} onPress={onScan}
              icon={<ScanIcon color={theme.tint} />}
              title={str.scanTitle} subtitle={str.scanSub} />
            <ActionRow theme={theme} iconBg={theme.successBg} onPress={onDescribe}
              icon={<ChatIcon color={theme.success} />}
              title={str.describeTitle} subtitle={str.describeSub} />
            {vm.moment === undefined && (
              <ActionRow theme={theme} iconBg={theme.softOrangeBg} onPress={onLog} chevron={false}
                icon={<FlameIcon color={theme.macroProtein} />}
                title={vm.streak.current > 0 ? str.streakKeepTitle(vm.streak.current) : str.streakStartTitle}
                subtitle={vm.streak.current > 0 ? str.streakKeepSub : str.streakStartSub} />
            )}
            <WaterRow testID="water-add" theme={theme} label={str.water} addLabel={str.waterAdd}
              litres={vm.water.liters} goalLitres={vm.water.goalLiters}
              onAdd={onAddWater} onUndo={onUndoWater} />
          </>
        ) : (
          <>
            <NutritionCard theme={theme} targets={vm.targets} summary={vm.summary}
              onOpenDetail={() => setDetailOpen(true)} />
            {vm.moment !== undefined && <MomentSlot theme={theme} moment={vm.moment} />}
            <WaterRow testID="water-add" theme={theme} label={str.water} addLabel={str.waterAdd}
              litres={vm.water.liters} goalLitres={vm.water.goalLiters}
              onAdd={onAddWater} onUndo={onUndoWater} />

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

      <Modal visible={detailOpen && vm.kind === 'ready'} transparent animationType="slide"
        onRequestClose={() => setDetailOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setDetailOpen(false)} />
        {vm.kind === 'ready' && (
          <DetailSheet theme={theme} targets={vm.targets} summary={vm.summary}
            fibre={vm.fibre} onClose={() => setDetailOpen(false)} />
        )}
      </Modal>

      {vm.kind === 'ready' && vm.celebration !== undefined && (
        <CelebrationOverlay theme={theme} title={vm.celebration.title} body={vm.celebration.body}
          streakLine={vm.celebration.streakLine} onDismiss={onDismissCelebration} />
      )}
    </View>
  );
}
