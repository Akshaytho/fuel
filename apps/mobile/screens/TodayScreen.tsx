import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import { Ring, MacroTile, ListRow, Card, NavPill } from '@fuel/ui';
import type { DaySummary, Targets, Meal } from '@fuel/domain';
import { str } from './strings';

/** Spec 0004 — purely presentational; data layer arrives in P1-05. */

export interface EntryVM { id: string; title: string; subtitle: string; trailing: string }
export interface MealSection { id: Meal; entries: EntryVM[] }

export type TodayVM =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      dateLabel: string;
      offline: boolean;
      targets: Targets;
      summary: DaySummary;
      meals: MealSection[];
    };

export interface TodayScreenProps {
  theme: Theme;
  vm: TodayVM;
  onLog: () => void;               // required — no dead controls (CLAUDE.md)
  onTab?: (index: number) => void;
}

function Skeleton({ theme, height, width = '100%' }: { theme: Theme; height: number; width?: number | `${number}%` }) {
  return <View style={{ height, width, borderRadius: radius.md, backgroundColor: theme.separator }} />;
}

function SummaryCard({ theme, targets, summary }: { theme: Theme; targets: Targets; summary: DaySummary }) {
  const remaining = Math.max(0, summary.remaining.kcal);
  const caption = summary.isOver ? str.overBy(-summary.remaining.kcal) : str.kcalLeft;
  return (
    <Card theme={theme}>
      <View style={{ alignItems: 'center', paddingVertical: space.s4, gap: space.s5 }}>
        <Ring theme={theme} progress={summary.progress.kcal} value={String(remaining)} caption={caption} />
        <View style={{ flexDirection: 'row', gap: space.s4, alignSelf: 'stretch' }}>
          <MacroTile theme={theme} label={str.protein} consumed_g={summary.consumed.protein_g} target_g={targets.protein_g} color={theme.macroProtein} />
          <MacroTile theme={theme} label={str.carbs} consumed_g={summary.consumed.carbs_g} target_g={targets.carbs_g} color={theme.macroCarbs} />
          <MacroTile theme={theme} label={str.fat} consumed_g={summary.consumed.fat_g} target_g={targets.fat_g} color={theme.macroFat} />
        </View>
      </View>
    </Card>
  );
}

function EmptyCard({ theme, onLog }: { theme: Theme; onLog: () => void }) {
  return (
    <Card theme={theme}>
      <View style={{ alignItems: 'center', gap: space.s2, paddingVertical: space.s6 }}>
        <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>
          {str.emptyTitle}
        </Text>
        <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel, textAlign: 'center', maxWidth: 260 }}>
          {str.emptyBody}
        </Text>
        <Pressable
          onPress={onLog}
          style={{ marginTop: space.s3, backgroundColor: theme.tint, paddingHorizontal: space.s5, paddingVertical: space.s3, borderRadius: radius.pill }}
        >
          <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.onTint }}>{str.emptyCta}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export function TodayScreen({ theme, vm, onLog, onTab }: TodayScreenProps) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.s4, paddingBottom: space.s12 + space.s10, gap: space.s4 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight, color: theme.label }}>
            {str.today}
          </Text>
          {vm.kind === 'ready' && (
            <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{vm.dateLabel}</Text>
          )}
        </View>

        {vm.kind === 'ready' && vm.offline && (
          <View style={{ backgroundColor: theme.cardElevated, borderRadius: radius.md, paddingVertical: space.s2, paddingHorizontal: space.s3, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{str.offline}</Text>
          </View>
        )}

        {vm.kind === 'loading' ? (
          <View style={{ gap: space.s4 }}>
            <Skeleton theme={theme} height={264} />
            <Skeleton theme={theme} height={20} width="30%" />
            <Skeleton theme={theme} height={168} />
          </View>
        ) : (
          <>
            <SummaryCard theme={theme} targets={vm.targets} summary={vm.summary} />
            {vm.meals.length === 0 ? (
              <EmptyCard theme={theme} onLog={onLog} />
            ) : (
              vm.meals.map((m) => (
                <Card key={m.id} theme={theme} header={str.meals[m.id]}>
                  {m.entries.map((e, i) => (
                    <ListRow
                      key={e.id}
                      theme={theme}
                      title={e.title}
                      subtitle={e.subtitle}
                      trailing={e.trailing}
                      divider={i < m.entries.length - 1}
                    />
                  ))}
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: space.s6 }}>
        <NavPill theme={theme} tabs={str.tabs} activeIndex={0} onTab={onTab} onLog={onLog} />
      </View>
    </View>
  );
}
