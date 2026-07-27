import React from 'react';
import { SafeAreaView, Alert, useColorScheme } from 'react-native';
import { light, dark } from '@fuel/tokens';
import { computeTargets, summarizeDay, type LogEntryInput } from '@fuel/domain';
import { TodayScreen, type TodayVM } from './screens/TodayScreen';

// TODO(stub): P1-05 — real offline store replaces this demo data provider.
const targets = computeTargets({
  sex: 'male', age_years: 30, height_cm: 175, weight_kg: 70,
  activity: 'moderate', goal: 'maintain',
});
const chicken = { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 };
const banana = { kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 };
const entries: LogEntryInput[] = [
  { per100g: chicken, grams: 150 },
  { per100g: banana, grams: 118 },
];
const summary = summarizeDay(entries, targets);

const vm: TodayVM = {
  kind: 'ready',
  dateLabel: 'Monday, July 27',
  offline: false,
  targets,
  summary,
  entries: [
    { id: '1', title: 'Grilled chicken breast', subtitle: 'Lunch · 248 kcal', proteinLabel: '47g' },
    { id: '2', title: 'Banana', subtitle: 'Lunch · 105 kcal', proteinLabel: '1g' },
  ],
  streak: { days: 1, isLongest: false },
  water: { liters: 0, goalLiters: 3 },
  coach: `Nice — ${Math.max(0, Math.round(targets.protein_g - summary.consumed.protein_g))} g protein to go. Dinner covers it.`,
};

const stub = (what: string) => () => Alert.alert(what, 'Arrives with a later task.'); // TODO(stub): P1-04

export default function App() {
  const theme = useColorScheme() === 'dark' ? dark : light;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <TodayScreen
        theme={theme} vm={vm}
        onLog={stub('Log')} onScan={stub('Scan')} onDescribe={stub('Describe')}
        onTab={() => {}} onProfile={stub('Profile')}
      />
    </SafeAreaView>
  );
}
