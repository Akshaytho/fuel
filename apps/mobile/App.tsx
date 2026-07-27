import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, Alert, useColorScheme, Modal, View, Pressable } from 'react-native';
import { light, dark } from '@fuel/tokens';
import { scalePer100g, summarizeDay, mealForHour, type Targets, type Meal } from '@fuel/domain';
import { LogStore } from '@fuel/store';
import { sqliteAdapter } from './data/sqliteAdapter';
import { createSupabaseFoodRepo, type FoodHit } from './data/foodRepo';
import { TodayScreen, type TodayVM } from './screens/TodayScreen';
import { LogSheet, SearchScreen, PortionSheet } from './screens/logflow';

// TODO(stub): P1-03 — targets come from onboarding; sensible default until then.
const DEFAULT_TARGETS: Targets = { kcal: 2400, protein_g: 160, carbs_g: 260, fat_g: 75, clamped: false };

// TODO(stub): P1-03 — remote sync attaches after auth (user JWT); local-only until then.
const store = new LogStore(sqliteAdapter);

const repo = createSupabaseFoodRepo(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
);

const todayISO = () => new Date().toISOString().slice(0, 10);
const dateLabel = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export default function App() {
  const theme = useColorScheme() === 'dark' ? dark : light;
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((x) => x + 1);
  const [sheet, setSheet] = useState<'none' | 'log' | 'search' | 'portion'>('none');
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodHit[]>([]);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => { store.init().then(() => setReady(true)); }, []);

  useEffect(() => {
    let alive = true;
    if (query.trim().length < 2) { setResults([]); return; }
    repo.search(query).then((r) => { if (alive) { setResults(r); setSearchError(false); } })
      .catch(() => { if (alive) setSearchError(true); });
    return () => { alive = false; };
  }, [query]);

  const vm: TodayVM = useMemo(() => {
    if (!ready) return { kind: 'loading' };
    const day = todayISO();
    const entries = store.entriesForDay(day);
    const consumed = store.consumedForDay(day);
    const base = summarizeDay([], DEFAULT_TARGETS);
    return {
      kind: 'ready',
      dateLabel: dateLabel() + (entries.length === 0 ? ' · Day 1' : ''),
      offline: false, // TODO(P1-03): pendingCount>0 once remote sync attaches
      targets: DEFAULT_TARGETS,
      summary: {
        ...base,
        consumed,
        remaining: {
          kcal: Math.round(DEFAULT_TARGETS.kcal - consumed.kcal),
          protein_g: DEFAULT_TARGETS.protein_g - consumed.protein_g,
          carbs_g: DEFAULT_TARGETS.carbs_g - consumed.carbs_g,
          fat_g: DEFAULT_TARGETS.fat_g - consumed.fat_g,
        },
        progress: {
          kcal: consumed.kcal / DEFAULT_TARGETS.kcal,
          protein: consumed.protein_g / DEFAULT_TARGETS.protein_g,
          carbs: consumed.carbs_g / DEFAULT_TARGETS.carbs_g,
          fat: consumed.fat_g / DEFAULT_TARGETS.fat_g,
        },
        isOver: consumed.kcal > DEFAULT_TARGETS.kcal,
        entryCount: entries.length,
      },
      entries: entries.map((e) => ({
        id: e.client_id, title: e.food_name,
        subtitle: `${Math.round(e.grams)} g · ${Math.round(e.kcal)} kcal`,
        proteinLabel: `${Math.round(e.protein_g)}g`,
      })),
      streak: entries.length > 0 ? { days: 1, isLongest: false } : undefined,
      water: entries.length > 0 ? { liters: 0, goalLiters: 3 } : undefined,
      coach: entries.length > 0
        ? `Nice — ${Math.max(0, Math.round(DEFAULT_TARGETS.protein_g - consumed.protein_g))} g protein to go.`
        : undefined,
    };
  }, [ready, tick]);

  const logIt = async (grams: number, _meal: Meal) => {
    if (!picked) return;
    const per100 = {
      kcal: picked.kcal_per_100g, protein_g: picked.protein_g_per_100g,
      carbs_g: picked.carbs_g_per_100g, fat_g: picked.fat_g_per_100g,
    };
    await store.add({
      day: todayISO(), food_id: picked.id, food_name: picked.name, grams,
      ...scalePer100g(per100, grams),
      source: 'search', logged_at: new Date().toISOString(),
    });
    bump();
    setSheet('none'); setPicked(null); setQuery(''); setResults([]);
  };

  const soon = (what: string) => () => Alert.alert(what, 'Arrives in Phase 2.'); // TODO(stub): P2

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <TodayScreen
        theme={theme} vm={vm}
        onLog={() => setSheet('log')}
        onScan={soon('Scan')} onDescribe={soon('Describe')}
        onTab={() => {}} // TODO(stub): P1 router — other tabs are later-phase screens
        onProfile={soon('Profile')}
      />

      <Modal visible={sheet !== 'none'} transparent animationType="slide" onRequestClose={() => setSheet('none')}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setSheet('none')} />
        <View>
          {sheet === 'log' && (
            <LogSheet theme={theme} mealLabel={mealLabel()}
              goTos={[] /* derives from history once it exists — never hardcoded */}
              onSearchFocus={() => setSheet('search')}
              onScan={soon('Scan')} onDescribe={soon('Describe')} onLabel={soon('Label')}
              onSaved={soon('Saved')} onCopyYesterday={soon('Copy yesterday')}
              onQuickAdd={() => {}} />
          )}
          {sheet === 'search' && (
            <View style={{ height: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
              <SearchScreen theme={theme} query={query} error={searchError}
                results={results.map((r) => ({
                  id: r.id, name: r.name,
                  subtitle: `100 g · ${Math.round(r.kcal_per_100g)} kcal · ${Math.round(r.protein_g_per_100g)} g protein`,
                }))}
                onQuery={setQuery}
                onCancel={() => { setSheet('log'); setQuery(''); }}
                onAdd={(id) => { const f = results.find((x) => x.id === id); if (f) { setPicked(f); setSheet('portion'); } }}
                onDescribe={soon('Describe')} />
            </View>
          )}
          {sheet === 'portion' && picked && (
            <PortionSheet theme={theme} foodName={picked.name}
              usualNote={`per 100 g · ${Math.round(picked.kcal_per_100g)} kcal`}
              per100g={{
                kcal: picked.kcal_per_100g, protein_g: picked.protein_g_per_100g,
                carbs_g: picked.carbs_g_per_100g, fat_g: picked.fat_g_per_100g,
              }}
              options={[
                { label: '50 g', grams: 50 }, { label: '100 g', grams: 100 },
                { label: '150 g', grams: 150 }, { label: '200 g', grams: 200 },
              ]}
              initialIndex={1} initialMeal={mealForHour(new Date().getHours())}
              onEditFood={soon('Edit food')} onLog={logIt} />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function mealLabel(): string {
  const m = mealForHour(new Date().getHours());
  return m.charAt(0).toUpperCase() + m.slice(1);
}
