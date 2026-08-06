import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import {
  TabBar, Segmented, TrendLineChart, DayBarChart, WeekBarChart,
  FadeSlideIn, pressedStyle, WeekStrip, type WeekStripDay,
} from '@fuel/ui';
import { tr } from './trendsStrings';
import { ReportBody, type ReportVM } from './ReportScreen';

/** Trends (spec 0009, design 4f). Everything rendered here is REAL data —
    the VM is computed in AppRoot from stores via tested domain functions. */

export interface TrendsVM {
  /** IA 0001: the 7-dot week, moved off Today */
  week: { days: WeekStripDay[]; summary: string; footnote?: string | undefined;
          /** E-05: 3+ logged days this week — the validated success floor */
          floorHit: boolean };
  /** the run, explained in full — the chip on Today only carries the number */
  streak: { current: number; suffix: string };
  weight: {
    heroKg: number | null;            // latest trend weight; null = no weigh-ins
    deltaKg: number | null;           // vs first weigh-in in window
    deltaGood: boolean;               // direction serves the user's goal
    sinceLabel: string;
    raw: { x: number; y: number }[];
    trend: { x: number; y: number }[];
    xLabels: string[];
    slopeKgPerWeek: number | null;    // null = honest "—"
  };
  energy: {
    days: number[];                   // kcal per day, oldest→newest (14)
    target: number;
    xLabels: string[];
    avgEaten: number | null;          // mean of logged days only
  };
  consistency: {
    weeks: number[];                  // protein hit-days per week (8)
    lastWeekHits: number;
    loggedPct: number;
    anyLogs: boolean;
  };
}

export interface TrendsScreenProps {
  theme: Theme;
  vm: TrendsVM;
  /** IA 0001: Report merged in here as the Week segment */
  report: ReportVM;
  onConfirmDay: (day: string) => void;
  onAcceptTargets: () => void;
  onAdjustTargets: () => void;
  onLogWeight: () => void;
  onTab: (i: number) => void;
  onLog: () => void;
}

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US');

/** Design-4f stat tile: bold value, quiet caption beneath. */
function StatTile({ theme, value, caption, testID }: {
  theme: Theme; value: string; caption: string; testID?: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4, gap: 2 }}>
      <Text testID={testID} style={{ fontSize: t.title2.size, fontWeight: '800', color: theme.label }}>{value}</Text>
      <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{caption}</Text>
    </View>
  );
}

function Card({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4, gap: space.s3 }}>
      {children}
    </View>
  );
}

function Empty({ theme, head, body, cta, onCta, testID }: {
  theme: Theme; head: string; body: string; cta?: string; onCta?: () => void; testID?: string;
}) {
  return (
    <Card theme={theme}>
      <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{head}</Text>
      <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{body}</Text>
      {cta !== undefined && (
        <Pressable testID={testID} onPress={onCta} style={({ pressed }) => [{
          backgroundColor: theme.softBlueBg, borderRadius: radius.md, alignItems: 'center', paddingVertical: space.s3,
        }, pressedStyle(pressed)]}>
          <Text style={{ fontSize: t.subhead.size, fontWeight: '700', color: theme.tint }}>{cta}</Text>
        </Pressable>
      )}
    </Card>
  );
}

export function TrendsScreen({
  theme, vm, report, onConfirmDay, onAcceptTargets, onAdjustTargets, onLogWeight, onTab, onLog,
}: TrendsScreenProps) {
  // Week is FIRST: "how has this week gone" is the question people actually
  // arrive with, and it is the one Today no longer answers (IA 0001).
  const [seg, setSeg] = useState(0);
  const w = vm.weight;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.s4, paddingBottom: 120, gap: space.s4 }}>
        <Text style={{ fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight, color: theme.label }}>
          {tr.title}
        </Text>
        <Segmented theme={theme} value={seg} onChange={setSeg}
          options={[tr.segWeek, tr.segWeight, tr.segEnergy, tr.segConsistency]} />

        {seg === 0 && (
          <FadeSlideIn key="week" style={{ gap: space.s4 }}>
            <WeekStrip testID="week-summary" theme={theme} days={vm.week.days}
              summary={vm.week.summary} footnote={vm.week.footnote} />
            {vm.week.floorHit && (
              <View testID="weekly-floor" style={{
                backgroundColor: theme.successBg, borderRadius: radius.md,
                paddingVertical: space.s3, paddingHorizontal: space.s4,
              }}>
                <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.onSuccessBg }}>
                  {tr.weeklyFloor}
                </Text>
              </View>
            )}
            {vm.streak.current > 0 && (
              <Card theme={theme}>
                <Text style={{ fontSize: t.footnote.size, fontWeight: '700', letterSpacing: 0.8, color: theme.secondaryLabel }}>
                  {tr.streakCaps}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text testID="streak-detail" style={{ fontSize: 28, fontWeight: '800', color: theme.label }}>
                    {vm.streak.current}
                    <Text style={{ fontSize: t.subhead.size, fontWeight: '400', color: theme.secondaryLabel }}>
                      {' '}{vm.streak.suffix}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 26 }}>🔥</Text>
                </View>
              </Card>
            )}
            {/* IA 0001 consequence, fixed: merging Report in made weigh-in one
                tap deeper. Weighing is the report's own fuel, so it gets an
                affordance right here on the default segment. */}
            <Pressable testID="week-log-weight" onPress={onLogWeight}
              style={({ pressed }) => [{
                backgroundColor: theme.card, borderRadius: radius.card,
                paddingVertical: space.s3, paddingHorizontal: space.s4,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              }, pressedStyle(pressed)]}>
              <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.label }}>
                {tr.weekWeighRow}
              </Text>
              <Text style={{ fontSize: t.subhead.size, fontWeight: '700', color: theme.tint }}>
                {tr.logWeight}
              </Text>
            </Pressable>
            <ReportBody theme={theme} vm={report} onConfirmDay={onConfirmDay}
              onAccept={onAcceptTargets} onAdjust={onAdjustTargets} />
          </FadeSlideIn>
        )}

        {seg === 1 && (
          <FadeSlideIn key="w" style={{ gap: space.s4 }}>
            {w.heroKg === null ? (
              <Empty theme={theme} head={tr.weightEmptyHead} body={tr.weightEmptyBody}
                cta={tr.logWeight} onCta={onLogWeight} testID="log-weight-cta" />
            ) : (
              <>
                <Card theme={theme}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text testID="weight-hero" style={{ fontSize: 34, fontWeight: '800', color: theme.label }}>
                        {fmt1(w.heroKg)}
                        <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.secondaryLabel }}> {tr.kg}</Text>
                      </Text>
                      <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{tr.trendToday}</Text>
                    </View>
                    {w.deltaKg !== null && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{
                          fontSize: t.title2.size, fontWeight: '800',
                          color: w.deltaGood ? theme.success : theme.danger,
                        }}>
                          {w.deltaKg > 0 ? '+' : w.deltaKg < 0 ? '−' : ''}{fmt1(Math.abs(w.deltaKg))} {tr.kg}
                        </Text>
                        <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{w.sinceLabel}</Text>
                      </View>
                    )}
                  </View>
                  <TrendLineChart theme={theme} raw={w.raw} trend={w.trend} xLabels={w.xLabels} testID="weight-chart" />
                </Card>
                <View style={{ flexDirection: 'row', gap: space.s3 }}>
                  <StatTile theme={theme} testID="slope-tile"
                    value={w.slopeKgPerWeek === null ? tr.noSlope : `${w.slopeKgPerWeek > 0 ? '+' : ''}${fmt1(w.slopeKgPerWeek)}`}
                    caption={tr.kgPerWeek} />
                  <StatTile theme={theme} value={`${vm.consistency.loggedPct}%`} caption={tr.daysLogged} />
                </View>
                <Pressable testID="log-weight-cta" onPress={onLogWeight} style={({ pressed }) => [{
                  backgroundColor: theme.card, borderRadius: radius.card, alignItems: 'center', paddingVertical: space.s4,
                }, pressedStyle(pressed)]}>
                  <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: theme.tint }}>{tr.logWeight}</Text>
                </Pressable>
              </>
            )}
          </FadeSlideIn>
        )}

        {seg === 2 && (
          <FadeSlideIn key="e" style={{ gap: space.s4 }}>
            {vm.energy.days.every((d) => d <= 0) ? (
              <Empty theme={theme} head={tr.energyEmptyHead} body={tr.energyEmptyBody} />
            ) : (
              <>
                <Card theme={theme}>
                  <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>
                    {tr.energyTitle}
                  </Text>
                  <DayBarChart theme={theme} values={vm.energy.days} target={vm.energy.target}
                    xLabels={vm.energy.xLabels} testID="energy-chart" />
                  <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>
                    {tr.energyTarget(vm.energy.target.toLocaleString('en-US'))}
                  </Text>
                </Card>
                <View style={{ flexDirection: 'row', gap: space.s3 }}>
                  {vm.energy.avgEaten !== null && (
                    <StatTile theme={theme} testID="avg-eaten-tile"
                      value={Math.round(vm.energy.avgEaten).toLocaleString('en-US')} caption={tr.avgEaten} />
                  )}
                  <StatTile theme={theme} value={vm.energy.target.toLocaleString('en-US')} caption={tr.targetKcal} />
                </View>
              </>
            )}
          </FadeSlideIn>
        )}

        {seg === 3 && (
          <FadeSlideIn key="c" style={{ gap: space.s4 }}>
            {!vm.consistency.anyLogs ? (
              <Empty theme={theme} head={tr.consistencyEmptyHead} body={tr.consistencyEmptyBody} />
            ) : (
              <>
                <Card theme={theme}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>
                      {tr.proteinWeeks}
                    </Text>
                    <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>
                      {tr.weeksLabel(vm.consistency.weeks.length)}
                    </Text>
                  </View>
                  <WeekBarChart theme={theme} values={vm.consistency.weeks} max={7} testID="protein-weeks-chart" />
                  <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>
                    {tr.bestYet(vm.consistency.lastWeekHits)}
                  </Text>
                </Card>
                <View style={{ flexDirection: 'row', gap: space.s3 }}>
                  <StatTile theme={theme} value={`${vm.consistency.loggedPct}%`}
                    caption={tr.daysLogged} testID="logged-pct-tile" />
                </View>
              </>
            )}
          </FadeSlideIn>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <TabBar theme={theme} activeIndex={1} onTab={onTab} onLog={onLog} soonIndices={[]} />
      </View>
    </View>
  );
}
