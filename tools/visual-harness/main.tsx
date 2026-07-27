import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { light, dark, space, radius, type as t, Theme } from '@fuel/tokens';
import { Ring, MacroTile, ListRow, Card, NavPill } from '@fuel/ui';

/** A Summary-like composition of every primitive, per theme. */
function Sample({ theme, name }: { theme: Theme; name: string }) {
  return (
    <View style={{
      width: 390, backgroundColor: theme.bg, padding: space.s4,
      gap: space.s4, borderRadius: radius.sheet,
    }}>
      <Text style={{ fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight, color: theme.label }}>
        Today
      </Text>

      <Card theme={theme}>
        <View style={{ alignItems: 'center', paddingVertical: space.s4, gap: space.s4 }}>
          <Ring theme={theme} progress={0.62} value="812" caption="kcal left" />
          <View style={{ flexDirection: 'row', gap: space.s4, alignSelf: 'stretch' }}>
            <MacroTile theme={theme} label="Protein" consumed_g={86} target_g={126} color={theme.macroProtein} />
            <MacroTile theme={theme} label="Carbs" consumed_g={148} target_g={232} color={theme.macroCarbs} />
            <MacroTile theme={theme} label="Fat" consumed_g={71} target_g={68} color={theme.macroFat} />
          </View>
        </View>
      </Card>

      <Card theme={theme} header="Lunch">
        <ListRow theme={theme} title="Grilled chicken breast" subtitle="150 g · scanned" trailing="248 kcal" />
        <ListRow theme={theme} title="A very long food name that should truncate with an ellipsis rather than wrap" subtitle="1 serving" trailing="105 kcal" />
        <ListRow theme={theme} title="Banana" subtitle="118 g" trailing="105 kcal" divider={false} />
      </Card>

      {/* over-target ring case */}
      <View style={{ flexDirection: 'row', gap: space.s4, alignItems: 'center' }}>
        <Ring theme={theme} progress={1.3} size={72} strokeWidth={8} />
        <Text style={{ color: theme.secondaryLabel, fontSize: t.footnote.size }}>over-target (danger)</Text>
      </View>

      <NavPill theme={theme} tabs={['Today', 'Trends', 'You']} activeIndex={0} onTab={() => {}} onLog={() => {}} />
      <Text style={{ color: theme.secondaryLabel, fontSize: t.caption.size, textAlign: 'center' }}>{name}</Text>
    </View>
  );
}

function App() {
  return (
    <View style={{ flexDirection: 'row', gap: 24, padding: 24, backgroundColor: '#8E8E93' }}>
      <Sample theme={light} name="light" />
      <Sample theme={dark} name="dark" />
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
