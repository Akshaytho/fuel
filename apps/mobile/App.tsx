import React from 'react';
import { SafeAreaView, Alert, useColorScheme } from 'react-native';
import { light, dark } from '@fuel/tokens';
import { computeTargets, summarizeDay, type LogEntryInput } from '@fuel/domain';
import { TodayScreen, type TodayVM } from './screens/TodayScreen';

// TODO(stub): P1-05 — real offline store replaces this demo data provider.
const demoProfileTargets = computeTargets({
  sex: 'male', age_years: 30, height_cm: 175, weight_kg: 70,
  activity: 'moderate', goal: 'maintain',
});

const chicken = { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 };
const banana = { kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 };
const demoEntries: LogEntryInput[] = [
  { per100g: chicken, grams: 150 },
  { per100g: banana, grams: 118 },
];

const vm: TodayVM = {
  kind: 'ready',
  dateLabel: 'Monday, 27 July',
  offline: false,
  targets: demoProfileTargets,
  summary: summarizeDay(demoEntries, demoProfileTargets),
  meals: [
    {
      id: 'lunch',
      entries: [
        { id: '1', title: 'Grilled chicken breast', subtitle: '150 g · scanned', trailing: '248 kcal' },
        { id: '2', title: 'Banana', subtitle: '118 g', trailing: '105 kcal' },
      ],
    },
  ],
};

export default function App() {
  const theme = useColorScheme() === 'dark' ? dark : light;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <TodayScreen
        theme={theme}
        vm={vm}
        onLog={() => Alert.alert('Log', 'Logging arrives with P1-04.')} // TODO(stub): P1-04
        onTab={() => {}} // TODO(stub): P1 router task
      />
    </SafeAreaView>
  );
}
