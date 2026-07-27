import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { light, dark, Theme } from '@fuel/tokens';
import { computeTargets, summarizeDay, type LogEntryInput, type Targets } from '@fuel/domain';
import { TodayScreen, type TodayVM } from '../../apps/mobile/screens/TodayScreen';

const targets: Targets = computeTargets({
  sex: 'male', age_years: 30, height_cm: 175, weight_kg: 70,
  activity: 'moderate', goal: 'maintain',
});
const chicken = { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 };
const banana = { kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 };
const oats = { kcal: 379, protein_g: 13.2, carbs_g: 67.7, fat_g: 6.5 };

const normalEntries: LogEntryInput[] = [
  { per100g: oats, grams: 60 }, { per100g: chicken, grams: 150 }, { per100g: banana, grams: 118 },
];
const overEntries: LogEntryInput[] = [{ per100g: chicken, grams: 400 }, { per100g: oats, grams: 700 }];

const vms: Record<string, TodayVM> = {
  loading: { kind: 'loading' },
  empty: {
    kind: 'ready', dateLabel: 'Monday, 27 July', offline: false,
    targets, summary: summarizeDay([], targets), meals: [],
  },
  normal: {
    kind: 'ready', dateLabel: 'Monday, 27 July', offline: true,
    targets, summary: summarizeDay(normalEntries, targets),
    meals: [
      { id: 'breakfast', entries: [{ id: 'b1', title: 'Rolled oats', subtitle: '60 g', trailing: '227 kcal' }] },
      { id: 'lunch', entries: [
        { id: 'l1', title: 'Grilled chicken breast with a very long name to truncate', subtitle: '150 g · scanned', trailing: '248 kcal' },
        { id: 'l2', title: 'Banana', subtitle: '118 g', trailing: '105 kcal' },
      ] },
    ],
  },
  over: {
    kind: 'ready', dateLabel: 'Monday, 27 July', offline: false,
    targets, summary: summarizeDay(overEntries, targets),
    meals: [
      { id: 'dinner', entries: [
        { id: 'd1', title: 'Chicken breast', subtitle: '400 g', trailing: '660 kcal' },
        { id: 'd2', title: 'Rolled oats', subtitle: '700 g', trailing: '2653 kcal' },
      ] },
    ],
  },
};

function Frame({ theme, name, vm }: { theme: Theme; name: string; vm: TodayVM }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>{name}</Text>
      <View style={{ width: 390, height: 700, borderRadius: 24, overflow: 'hidden' }}>
        <TodayScreen theme={theme} vm={vm} onLog={() => {}} onTab={() => {}} />
      </View>
    </View>
  );
}

function App() {
  return (
    <View style={{ backgroundColor: '#5a5a5e', padding: 24, gap: 24 }}>
      {(['light', 'dark'] as const).map((mode) => (
        <View key={mode} style={{ flexDirection: 'row', gap: 20 }}>
          {Object.entries(vms).map(([name, vm]) => (
            <Frame key={name} theme={mode === 'light' ? light : dark} name={`${name} · ${mode}`} vm={vm} />
          ))}
        </View>
      ))}
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
