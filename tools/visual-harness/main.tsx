import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { light, dark, Theme } from '@fuel/tokens';
import { LogSheet, SearchScreen, PortionSheet } from '../../apps/mobile/screens/logflow';

// Harness fixtures mirror the DESIGN's demo content for direct comparison
// (fixtures only — app code contains no data, per CLAUDE.md rule).
const goTos = [
  { id: '1', name: 'Chicken burrito bowl', subtitle: '740 kcal · 48 g protein' },
  { id: '2', name: 'Dal with rice', subtitle: '520 kcal · 21 g protein' },
  { id: '3', name: 'Paneer wrap', subtitle: '480 kcal · 26 g protein' },
  { id: '4', name: 'Whey shake', subtitle: '130 kcal · 27 g protein' },
  { id: '5', name: 'Apple', subtitle: '95 kcal · 0 g protein' },
];
const results = [
  { id: 'a', name: 'Paneer, raw', subtitle: '100 g · 265 kcal · 18 g protein' },
  { id: 'b', name: 'Paneer wrap', subtitle: '1 wrap · 480 kcal · 26 g protein', frequent: true },
  { id: 'c', name: 'Palak paneer', subtitle: '1 bowl · 320 kcal · 14 g protein' },
  { id: 'd', name: 'Paneer tikka', subtitle: '6 pieces · 290 kcal · 22 g protein' },
];
// Paneer wrap per-100g so 1 wrap (150 g) ≈ design's 480 kcal / 26 P / 44 C / 21 F
const wrapPer100 = { kcal: 320, protein_g: 17.3, carbs_g: 29.3, fat_g: 14 };
const options = [
  { label: '½ wrap', grams: 75 }, { label: '1 wrap', grams: 150 },
  { label: '1½', grams: 225 }, { label: '2', grams: 300 }, { label: 'g ▾', grams: 150 },
];

const noop = () => {};

function Frame({ theme, name, children, sheet }: { theme: Theme; name: string; children: React.ReactNode; sheet?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>{name}</Text>
      <View style={{
        width: 390, height: 840, borderRadius: 24, overflow: 'hidden',
        backgroundColor: sheet ? '#8e8e93' : theme.bg,
        justifyContent: sheet ? 'flex-end' : 'flex-start',
      }}>
        {children}
      </View>
    </View>
  );
}

function Row({ theme, tag }: { theme: Theme; tag: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 20 }}>
      <Frame theme={theme} name={`log sheet · ${tag}`} sheet>
        <LogSheet theme={theme} mealLabel="Lunch" goTos={goTos}
          onSearchFocus={noop} onScan={noop} onDescribe={noop} onLabel={noop}
          onSaved={noop} onCopyYesterday={noop} onQuickAdd={noop} />
      </Frame>
      <Frame theme={theme} name={`search · ${tag}`}>
        <SearchScreen theme={theme} query="panee" results={results}
          onQuery={noop} onCancel={noop} onAdd={noop} onDescribe={noop} />
      </Frame>
      <Frame theme={theme} name={`portion · ${tag}`} sheet>
        <PortionSheet theme={theme} foodName="Paneer wrap"
          usualNote="Usually logged at lunch · your usual: 1 wrap"
          per100g={wrapPer100} options={options} initialIndex={1} initialMeal="lunch"
          onEditFood={noop} onLog={noop} />
      </Frame>
    </View>
  );
}

function App() {
  return (
    <View style={{ backgroundColor: '#5a5a5e', padding: 24, gap: 24 }}>
      <Row theme={light} tag="light" />
      <Row theme={dark} tag="dark" />
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
