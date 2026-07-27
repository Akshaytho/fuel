import React from 'react';
import { SafeAreaView, ScrollView, Text, View, useColorScheme } from 'react-native';
import { light, dark, space, radius, type as t } from '@fuel/tokens';
import { computeTargets } from '@fuel/domain';

/**
 * Today screen shell — P0-08. Proves tokens + domain wire into the app.
 * Real Today screen is P1-02 (spec first, per docs/playbook.md).
 */
export default function App() {
  const theme = useColorScheme() === 'dark' ? dark : light;

  // TODO(stub): P1-03 — targets come from onboarding; demo profile until then.
  const targets = computeTargets({
    sex: 'male', age_years: 30, height_cm: 175, weight_kg: 70,
    activity: 'moderate', goal: 'maintain',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.s4 }}>
        <Text style={{
          fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight,
          color: theme.label, marginBottom: space.s4,
        }}>
          Today
        </Text>
        <View style={{
          backgroundColor: theme.card, borderRadius: radius.card,
          padding: space.s5,
        }}>
          <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>
            {targets.kcal} kcal target
          </Text>
          <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel, marginTop: space.s1 }}>
            P {targets.protein_g}g · C {targets.carbs_g}g · F {targets.fat_g}g
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
