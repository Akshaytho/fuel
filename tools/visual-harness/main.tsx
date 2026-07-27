import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, Pressable } from 'react-native';
import { light, Theme } from '@fuel/tokens';
import { scalePer100g, summarizeDay, type Targets, type Meal } from '@fuel/domain';
import { LogStore, MemoryAdapter, type Remote, type LocalEntry } from '@fuel/store';
import { TodayScreen, type TodayVM } from '../../apps/mobile/screens/TodayScreen';
import { LogSheet, PortionSheet } from '../../apps/mobile/screens/logflow';

/* Interactive walkthrough harness (spec 0006 AC3): REAL LogStore + REAL
   screens; Playwright drives it. Fixtures only — no data in app code. */

const targets: Targets = { kcal: 2400, protein_g: 160, carbs_g: 260, fat_g: 75, clamped: false };
const TODAY = '2026-07-27';

interface FixtureFood { id: string; name: string; per100: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }; servingG: number; servingLabel: string }
const FOODS: FixtureFood[] = [
  { id: 'burrito', name: 'Chicken burrito bowl', per100: { kcal: 246.7, protein_g: 16, carbs_g: 22, fat_g: 9 }, servingG: 300, servingLabel: '1 bowl' },
  { id: 'banana', name: 'Banana', per100: { kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 }, servingG: 118, servingLabel: '1 medium' },
];

class ToggleRemote implements Remote {
  offline = false;
  pushed: string[] = [];
  async push(e: LocalEntry) {
    if (this.offline) throw new Error('offline');
    this.pushed.push(e.client_id);
  }
}
const remote = new ToggleRemote();
const store = new LogStore(new MemoryAdapter(), remote);

function App() {
  const theme: Theme = light;
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<'summary' | 'log' | 'portion'>('summary');
  const [food, setFood] = useState<FixtureFood>(FOODS[0]!);
  const [tick, setTick] = useState(0);
  const [fired, setFired] = useState('none');
  const bump = () => setTick((x) => x + 1);
  const fire = (name: string) => () => setFired(name);

  useEffect(() => { store.init().then(() => setReady(true)); }, []);

  const vm: TodayVM = useMemo(() => {
    if (!ready) return { kind: 'loading' };
    const entries = store.entriesForDay(TODAY);
    const summary = summarizeDay([], targets); // base, then substitute consumed
    const consumed = store.consumedForDay(TODAY);
    const real = {
      ...summary,
      consumed,
      remaining: {
        kcal: Math.round(targets.kcal - consumed.kcal),
        protein_g: targets.protein_g - consumed.protein_g,
        carbs_g: targets.carbs_g - consumed.carbs_g,
        fat_g: targets.fat_g - consumed.fat_g,
      },
      progress: {
        kcal: consumed.kcal / targets.kcal,
        protein: consumed.protein_g / targets.protein_g,
        carbs: consumed.carbs_g / targets.carbs_g,
        fat: consumed.fat_g / targets.fat_g,
      },
      isOver: consumed.kcal > targets.kcal,
      entryCount: entries.length,
    };
    return {
      kind: 'ready',
      dateLabel: 'Sunday, July 27' + (entries.length === 0 ? ' · Day 1' : ''),
      offline: store.pendingCount > 0,
      targets,
      summary: real,
      entries: entries.map((e, i) => ({
        id: e.client_id, title: e.food_name,
        subtitle: `Lunch · ${Math.round(e.kcal)} kcal`,
        proteinLabel: `${Math.round(e.protein_g)}g`,
      })),
      streak: entries.length > 0 ? { days: 1, isLongest: false } : undefined,
      water: entries.length > 0 ? { liters: 0, goalLiters: 3 } : undefined,
      coach: entries.length > 0
        ? `Nice — ${Math.max(0, Math.round(targets.protein_g - consumed.protein_g))} g protein to go. Dinner covers it.`
        : undefined,
    };
  }, [ready, tick]);

  const logIt = async (grams: number, _meal: Meal) => {
    const m = scalePer100g(food.per100, grams);
    await store.add({
      day: TODAY, food_id: null, food_name: food.name, grams,
      ...m, source: 'search', logged_at: new Date().toISOString(),
    });
    bump();
    await store.sync();     // background sync (fails silently when offline)
    bump();
    setScreen('summary');
  };

  return (
    <View style={{ backgroundColor: '#5a5a5e', padding: 24, gap: 12, minHeight: 900 }}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Text testID="pending" style={{ color: '#fff', fontFamily: 'monospace' }}>
          pending: {ready ? store.pendingCount : '-'}
        </Text>
        <Text testID="fired" style={{ color: '#fff', fontFamily: 'monospace' }}>fired: {fired}</Text>
        <Pressable testID="toggle-offline" onPress={() => { remote.offline = !remote.offline; bump(); }}>
          <Text style={{ color: '#ffd60a', fontFamily: 'monospace' }}>[toggle offline: {String(remote.offline)}]</Text>
        </Pressable>
        <Pressable testID="sync-now" onPress={async () => { await store.sync(); bump(); }}>
          <Text style={{ color: '#64d2ff', fontFamily: 'monospace' }}>[sync now]</Text>
        </Pressable>
      </View>

      <View style={{ width: 390, height: 844, borderRadius: 24, overflow: 'hidden', backgroundColor: '#8e8e93', justifyContent: 'flex-end' }}>
        {screen === 'summary' && (
          <TodayScreen theme={theme} vm={vm}
            onLog={() => setScreen('log')}
            onScan={fire('scan')} onDescribe={fire('describe')}
            onTab={(i) => setFired(`tab-${i}`)} onProfile={fire('profile')} />
        )}
        {screen === 'log' && (
          <LogSheet theme={theme} mealLabel="Lunch"
            goTos={FOODS.map((f) => ({ id: f.id, name: f.name, subtitle: `${Math.round(f.per100.kcal * f.servingG / 100)} kcal · ${Math.round(f.per100.protein_g * f.servingG / 100)} g protein` }))}
            onSearchFocus={fire('search-focus')}
            onScan={fire('scan')} onDescribe={fire('describe')} onLabel={fire('label')} onSaved={fire('saved')}
            onCopyYesterday={fire('copy-yesterday')}
            onQuickAdd={(id) => { setFood(FOODS.find((f) => f.id === id)!); setScreen('portion'); }} />
        )}
        {screen === 'portion' && (
          <PortionSheet theme={theme} foodName={food.name}
            usualNote={`Usually logged at lunch · your usual: ${food.servingLabel}`}
            per100g={food.per100}
            options={[
              { label: `½ ${food.servingLabel.split(' ')[1]}`, grams: food.servingG / 2 },
              { label: food.servingLabel, grams: food.servingG },
              { label: '1½', grams: food.servingG * 1.5 },
              { label: '2', grams: food.servingG * 2 },
            ]}
            initialIndex={1} initialMeal="lunch"
            onEditFood={fire('edit-food')} onLog={logIt} />
        )}
      </View>
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
