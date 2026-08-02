import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import { TabBar, CTAButton, TrendLineChart, FadeSlideIn, pressedStyle } from '@fuel/ui';
import type { WeeklyReport } from '@fuel/domain';
import { rp } from './reportStrings';

/** Weekly Report (spec 0010, design 4e). Every number is computed by the
    tested domain weeklyReport() — this file only lays it out. */

export interface ReportVM {
  report: WeeklyReport;
  rangeLabel: string;                       // "JUL 27–AUG 2"
  raw: { x: number; y: number }[];          // weigh-ins in the window
  trend: { x: number; y: number }[];
}

export interface ReportScreenProps {
  theme: Theme;
  vm: ReportVM;
  /** spec 0012: the user vouches for a day we suspected was half-logged */
  onConfirmDay: (day: string) => void;
  onAccept: () => void;
  onAdjust: () => void;
  onTab: (i: number) => void;
  onLog: () => void;
}

const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
const kg1 = (x: number) => (Math.round(Math.abs(x) * 10) / 10).toLocaleString('en-US');

function Card({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4, gap: space.s3 }}>
      {children}
    </View>
  );
}

export function ReportScreen({ theme, vm, onConfirmDay, onAccept, onAdjust, onTab, onLog }: ReportScreenProps) {
  const r = vm.report;
  const locked = r.verdict === 'insufficient';
  const head = locked ? rp.headLocked
    : r.verdict === 'on_pace' ? rp.headOnPace
    : r.verdict === 'faster' ? rp.headFaster : rp.headSlower;
  const verdictLine = r.verdict === 'on_pace' ? rp.vOnPace
    : r.verdict === 'faster' ? rp.vFaster : rp.vSlower;
  const dir = r.deltaKg === null || Math.abs(r.deltaKg) < 0.05 ? 'flat' : r.deltaKg < 0 ? 'down' : 'up';
  const slopeGood = r.deltaKg !== null && r.verdict === 'on_pace';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.s4, paddingBottom: 140, gap: space.s4 }}>
        <FadeSlideIn key={`report-${r.weekStart}`} style={{ gap: space.s4 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: t.footnote.size, fontWeight: '700', letterSpacing: 0.8, color: theme.secondaryLabel }}>
              {rp.weekCaps(r.weekNumber, vm.rangeLabel)}
            </Text>
            <Text testID="report-headline" style={{ fontSize: t.largeTitle.size, fontWeight: '800', color: theme.label }}>
              {head}
            </Text>
            <Text style={{ fontSize: t.body.size, color: theme.secondaryLabel }}>
              {locked ? rp.lockedBody : rp.narrative(dir, kg1(r.deltaKg ?? 0), verdictLine)}
            </Text>
          </View>

          {!locked && (
            <Card theme={theme}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{rp.weightTrend}</Text>
                <Text testID="report-slope" style={{
                  fontSize: t.subhead.size, fontWeight: '800',
                  color: slopeGood ? theme.success : theme.macroProtein,
                }}>
                  {(r.deltaKg ?? 0) > 0 ? '+' : (r.deltaKg ?? 0) < 0 ? '−' : ''}{kg1(r.deltaKg ?? 0)} {rp.kgPerWk}
                </Text>
              </View>
              <TrendLineChart theme={theme} raw={vm.raw} trend={vm.trend} height={90} xLabels={[]} testID="report-chart" />
            </Card>
          )}

          {!locked && r.blendedTdee !== null && (
            <Card theme={theme}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{rp.burnTitle}</Text>
                  <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{rp.burnSub}</Text>
                </View>
                <Text testID="report-burn" style={{ fontSize: t.title2.size, color: theme.secondaryLabel }}>
                  <Text style={{ textDecorationLine: 'line-through' }}>{n0(r.formulaTdee)}</Text>
                  <Text style={{ color: theme.label, fontWeight: '800' }}>  → {n0(r.blendedTdee)}</Text>
                </Text>
              </View>
            </Card>
          )}

          <Card theme={theme}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{rp.daysLogged}</Text>
              <Text testID="report-days" style={{ fontSize: t.headline.size, fontWeight: '800', color: theme.label }}>
                {r.loggedDays}/7
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: space.s2 }}>
              {r.dayClasses.map((cls, i) => (
                // THREE states, not two: a half-recorded day is neither a
                // logged day nor a missed one, and the pills must not lie
                // about which it was (spec 0012).
                <View key={i} testID={`report-pill-${i}`} style={{
                  flex: 1, height: 34, borderRadius: radius.md,
                  backgroundColor: cls === 'full' ? theme.success
                    : cls === 'partial' ? theme.softOrangeBg : theme.bg,
                  borderWidth: cls === 'full' ? 0 : cls === 'partial' ? 2 : 1,
                  borderColor: cls === 'partial' ? theme.macroProtein : theme.separator,
                }} />
              ))}
            </View>
            {r.excludedDays.length > 0 && (
              <View testID="report-excluded" style={{ gap: space.s2 }}>
                <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.label }}>
                  {rp.excludedTitle(r.excludedDays.length)}
                </Text>
                <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{rp.excludedBody}</Text>
                {r.excludedDays.map((d) => (
                  <Pressable key={d} testID={`confirm-day-${d}`} onPress={() => onConfirmDay(d)}
                    style={({ pressed }) => [{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingVertical: space.s2,
                    }, pressedStyle(pressed)]}>
                    <Text style={{ fontSize: t.subhead.size, color: theme.label }}>{rp.dayName(d)}</Text>
                    <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.tint }}>
                      {rp.excludedConfirm}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {locked && r.missing && (
              <View style={{ gap: 4 }}>
                {r.missing.loggedDays !== undefined && (
                  <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>· {rp.needDays(r.missing.loggedDays)}</Text>
                )}
                {r.missing.weighSpanDays !== undefined && (
                  <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>· {rp.needSpan(r.missing.weighSpanDays)}</Text>
                )}
              </View>
            )}
          </Card>

          {!locked && r.proposedTargets && (
            <Card theme={theme}>
              <Text style={{ fontSize: t.footnote.size, fontWeight: '700', letterSpacing: 0.8, color: theme.secondaryLabel }}>
                {rp.nextTargetsCaps}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.s6 }}>
                <View>
                  <Text testID="report-next-kcal" style={{ fontSize: 28, fontWeight: '800', color: theme.label }}>{n0(r.proposedTargets.kcal)}</Text>
                  <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{rp.kcalPerDay}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: theme.label }}>{Math.round(r.proposedTargets.protein_g)}g</Text>
                  <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{rp.proteinLabel}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: theme.label }}>
                    {r.weeklyGoalKg > 0 ? '+' : ''}{r.weeklyGoalKg}kg
                  </Text>
                  <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{rp.weeklyGoal}</Text>
                </View>
              </View>
            </Card>
          )}

          {!locked && r.proposedTargets && (
            <View style={{ gap: space.s3 }}>
              <CTAButton theme={theme} testID="accept-targets" label={rp.accept} onPress={onAccept} />
              <Pressable testID="adjust-manually" onPress={onAdjust} style={({ pressed }) => [{ alignItems: 'center', padding: space.s2 }, pressedStyle(pressed)]}>
                <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: theme.tint }}>{rp.adjust}</Text>
              </Pressable>
            </View>
          )}
        </FadeSlideIn>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <TabBar theme={theme} activeIndex={2} onTab={onTab} onLog={onLog} soonIndices={[]} />
      </View>
    </View>
  );
}
