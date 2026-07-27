import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { light, dark, Theme } from '@fuel/tokens';
import { computeTargets, summarizeDay, type LogEntryInput, type Targets } from '@fuel/domain';
import { TodayScreen, type TodayVM } from '../../apps/mobile/screens/TodayScreen';

// Mirror the design's demo numbers so comparison is direct:
// 2,400 target · 1,240 left · protein 96/160 · carbs 142 · fat 38
const targets: Targets = { kcal: 2400, protein_g: 160, carbs_g: 260, fat_g: 75, clamped: false };
const designDay = { kcal: 1160, protein_g: 96, carbs_g: 142, fat_g: 38 };
const per100 = { kcal: designDay.kcal / 2, protein_g: designDay.protein_g / 2, carbs_g: designDay.carbs_g / 2, fat_g: designDay.fat_g / 2 };
const entries: LogEntryInput[] = [{ per100g: per100, grams: 200 }];
const summary = summarizeDay(entries, targets);

const overEntries: LogEntryInput[] = [{ per100g: per100, grams: 560 }];

const mealVMs = [
  { id: '1', title: 'Greek yogurt with berries', subtitle: 'Breakfast · 240 kcal', proteinLabel: '22g' },
  { id: '2', title: '2 eggs, scrambled', subtitle: 'Breakfast · 180 kcal', proteinLabel: '12g' },
  { id: '3', title: 'Chicken burrito bowl', subtitle: 'Lunch · 740 kcal', proteinLabel: '48g' },
];

const vms: Record<string, TodayVM> = {
  normal: {
    kind: 'ready', dateLabel: 'Saturday, July 26', offline: false,
    targets, summary, entries: mealVMs,
    streak: { days: 12, isLongest: true }, water: { liters: 1.5, goalLiters: 3 },
    coach: 'Nice — 64 g protein to go. Dinner covers it.',
  },
  empty: {
    kind: 'ready', dateLabel: 'Sunday, July 27 · Day 1', offline: false,
    targets: { ...targets, kcal: 2050 }, summary: summarizeDay([], targets), entries: [],
  },
  loading: { kind: 'loading' },
  over: {
    kind: 'ready', dateLabel: 'Saturday, July 26', offline: true,
    targets, summary: summarizeDay(overEntries, targets), entries: mealVMs,
    streak: { days: 12, isLongest: true }, water: { liters: 1.5, goalLiters: 3 },
  },
};

function Frame({ theme, name, vm }: { theme: Theme; name: string; vm: TodayVM }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>{name}</Text>
      <View style={{ width: 390, height: 820, borderRadius: 24, overflow: 'hidden' }}>
        <TodayScreen theme={theme} vm={vm} onLog={() => {}} onScan={() => {}} onDescribe={() => {}} onTab={() => {}} onProfile={() => {}} />
      </View>
    </View>
  );
}

function App() {
  return (
    <View style={{ backgroundColor: '#5a5a5e', padding: 24, gap: 24 }}>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <Frame theme={light} name="normal · light (vs design 1)" vm={vms.normal!} />
        <Frame theme={light} name="empty · light (vs design 2)" vm={vms.empty!} />
        <Frame theme={dark} name="normal · dark (vs design 3)" vm={vms.normal!} />
      </View>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <Frame theme={light} name="loading · light" vm={vms.loading!} />
        <Frame theme={light} name="over+offline · light" vm={vms.over!} />
        <Frame theme={dark} name="empty · dark" vm={vms.empty!} />
      </View>
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
