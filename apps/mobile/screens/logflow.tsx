import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import {
  Sheet, SearchField, IconTile, FoodRow, SelectChip, MacroPreviewTile, CTAButton,
  ScanIcon, ChatIcon, Card,
} from '@fuel/ui';
import Svg, { Path, Rect } from 'react-native-svg';
import { scalePer100g, type FoodPer100g, type Meal } from '@fuel/domain';
import { logStr as s } from './logStrings';

/* ---------- shared VMs ---------- */
export interface QuickFoodVM { id: string; name: string; subtitle: string; often?: boolean }

/* ---------- Log sheet (spec 0005 §Log) ---------- */
export interface LogSheetProps {
  theme: Theme;
  mealLabel: string;
  goTos: QuickFoodVM[];
  onSearchFocus: () => void;
  onScan: () => void;      // TODO(stub): P2 barcode
  onDescribe: () => void;  // TODO(stub): P2 AI
  onLabel: () => void;     // TODO(stub): P2 label photo
  onSaved: () => void;     // TODO(stub): backlog saved foods
  /** how many items yesterday held — 0 hides the affordance (spec 0011) */
  yesterdayCount: number;
  onCopyYesterday: () => void;
  onQuickAdd: (id: string) => void;
}

function LabelIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Rect x="3.5" y="6.5" width="17" height="13" rx="3" stroke={color} strokeWidth="2" fill="none" />
      <Path d="M8.5 6.5 L9.8 4 h4.4 l1.3 2.5" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <Rect x="9" y="10.5" width="6" height="5" rx="2.5" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}
function BookmarkIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M7 4.5 h10 a1 1 0 0 1 1 1 V20 l-6-3.5 L6 20 V5.5 a1 1 0 0 1 1-1 Z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

export function LogSheet(p: LogSheetProps) {
  const { theme } = p;
  return (
    <Sheet theme={theme}>
      <View style={{ gap: space.s4 }}>
        <SearchField theme={theme} placeholder={s.searchAny} onFocus={p.onSearchFocus} onChange={() => p.onSearchFocus()} />
        <View style={{ flexDirection: 'row', gap: space.s3 }}>
          <IconTile theme={theme} label={s.scan} tint={theme.tint} bg={theme.softBlueBg} icon={<ScanIcon color={theme.tint} />} onPress={p.onScan} />
          <IconTile theme={theme} label={s.describe} tint={theme.success} bg={theme.successBg} icon={<ChatIcon color={theme.success} />} onPress={p.onDescribe} />
          <IconTile theme={theme} label={s.label} tint={theme.macroProtein} bg={theme.softOrangeBg} icon={<LabelIcon color={theme.macroProtein} />} onPress={p.onLabel} />
          <IconTile theme={theme} label={s.saved} tint={theme.macroCarbs} bg={theme.softPurpleBg} icon={<BookmarkIcon color={theme.macroCarbs} />} onPress={p.onSaved} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: t.footnote.size, fontWeight: '600', letterSpacing: 0.8, color: theme.secondaryLabel }}>
            {s.goTos(p.mealLabel)}
          </Text>
          {p.yesterdayCount > 0 && (
            <Pressable testID="copy-yesterday" onPress={p.onCopyYesterday} hitSlop={8}>
              <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.tint }}>
                {s.copyYesterdayN(p.yesterdayCount)}
              </Text>
            </Pressable>
          )}
        </View>
        {p.goTos.length > 0 ? (
          <>
            <Card theme={theme}>
              {p.goTos.map((f, i) => (
                <FoodRow key={f.id} theme={theme} title={f.name}
                  subtitle={f.often === true ? `${f.subtitle} · ${s.logOften}` : f.subtitle}
                  addTestID={`quickadd-${f.id}`}
                  onAdd={() => p.onQuickAdd(f.id)} divider={i < p.goTos.length - 1} />
              ))}
            </Card>
            <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel, textAlign: 'center' }}>{s.tapHint}</Text>
          </>
        ) : (
          <Card theme={theme}>
            <Text testID="gotos-empty" style={{ fontSize: t.subhead.size, color: theme.secondaryLabel, textAlign: 'center', paddingVertical: space.s3 }}>
              {s.goTosEmpty}
            </Text>
          </Card>
        )}
      </View>
    </Sheet>
  );
}

/* ---------- Search screen (spec 0005 §Search) ---------- */
export interface SearchResultVM {
  id: string; name: string; subtitle: string; frequent?: boolean;
}
export interface SearchScreenProps {
  theme: Theme;
  query: string;
  results: SearchResultVM[];
  error?: boolean;
  /** true while a debounced query is in flight — the user must never wonder
      whether we heard them (B-20). */
  busy?: boolean;
  onQuery: (q: string) => void;
  onCancel: () => void;
  onAdd: (id: string) => void;
  onDescribe: () => void;
}

function Highlight({ theme, name, query }: { theme: Theme; name: string; query: string }) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0 || !query) {
    return <Text numberOfLines={1} style={{ fontSize: t.body.size, fontWeight: '600', color: theme.label }}>{name}</Text>;
  }
  return (
    <Text numberOfLines={1} style={{ fontSize: t.body.size, fontWeight: '600', color: theme.label }}>
      {name.slice(0, idx)}
      <Text style={{ backgroundColor: theme.softOrangeBg }}>{name.slice(idx, idx + query.length)}</Text>
      {name.slice(idx + query.length)}
    </Text>
  );
}

export function SearchScreen(p: SearchScreenProps) {
  const { theme } = p;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: space.s4, gap: space.s3 }}>
      <SearchField theme={theme} value={p.query} placeholder={s.searchAny} onChange={p.onQuery} onCancel={p.onCancel} />
      <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{s.searchCaption}</Text>
      {p.error && (
        <Text style={{ fontSize: t.subhead.size, color: theme.danger }}>{s.searchError}</Text>
      )}
      {p.busy === true && !p.error && (
        <Text testID="search-busy" style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{s.searching}</Text>
      )}
      <ScrollView contentContainerStyle={{ gap: space.s3 }}>
        {p.results.length > 0 && (
          <Card theme={theme}>
            {p.results.map((r, i) => (
              <FoodRow key={r.id} theme={theme}
                titleNode={<Highlight theme={theme} name={r.name} query={p.query} />}
                subtitle={r.frequent ? `${r.subtitle} · ${s.logOften}` : r.subtitle}
                onAdd={() => p.onAdd(r.id)} divider={i < p.results.length - 1} addTestID={`add-${r.id}`} />
            ))}
          </Card>
        )}
        <Pressable onPress={p.onDescribe} style={{
          flexDirection: 'row', alignItems: 'center', gap: space.s3,
          backgroundColor: theme.card, borderRadius: radius.card, padding: space.s4,
        }}>
          <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: theme.successBg, alignItems: 'center', justifyContent: 'center' }}>
            <ChatIcon color={theme.success} size={18} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: t.headline.size, fontWeight: t.headline.weight, color: theme.label }}>{s.cantFind}</Text>
            <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{s.cantFindSub}</Text>
          </View>
          <Text style={{ fontSize: t.body.size, color: theme.secondaryLabel }}>{'›'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/* ---------- Portion sheet (spec 0005 §Portion) ---------- */
export interface PortionOption { label: string; grams: number }
export interface PortionSheetProps {
  theme: Theme;
  foodName: string;
  usualNote: string;
  per100g: FoodPer100g;
  options: PortionOption[];       // e.g. ½/1/1½/2 serving in grams
  initialIndex?: number;
  initialMeal?: Meal;
  onEditFood: () => void;         // TODO(stub): backlog
  onLog: (grams: number, meal: Meal) => void;
}

const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: s.breakfast }, { id: 'lunch', label: s.lunch },
  { id: 'dinner', label: s.dinner }, { id: 'snack', label: s.snack },
];

export function PortionSheet(p: PortionSheetProps) {
  const { theme } = p;
  const [sel, setSel] = useState(p.initialIndex ?? 1);
  const [meal, setMeal] = useState<Meal>(p.initialMeal ?? 'lunch');
  const grams = p.options[sel]?.grams ?? 100;
  const m = useMemo(() => scalePer100g(p.per100g, grams), [p.per100g, grams]);
  const mealLabel = MEALS.find((x) => x.id === meal)!.label;
  return (
    <Sheet theme={theme}>
      <View style={{ gap: space.s4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: t.title2.size, fontWeight: '700', color: theme.label }}>{p.foodName}</Text>
          <Pressable onPress={p.onEditFood}>
            <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.tint }}>{s.editFood}</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel, marginTop: -space.s3 }}>{p.usualNote}</Text>
        <View style={{ flexDirection: 'row', gap: space.s2, flexWrap: 'wrap' }}>
          {p.options.map((o, i) => (
            <SelectChip key={o.label} theme={theme} label={o.label} selected={i === sel} testID={`portion-${i}`} onPress={() => setSel(i)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.s2 }}>
          <MacroPreviewTile theme={theme} value={String(m.kcal)} label={s.kcalCaps} />
          <MacroPreviewTile theme={theme} value={`${Math.round(m.protein_g)}g`} label={s.proteinCaps} color={theme.macroProtein} />
          <MacroPreviewTile theme={theme} value={`${Math.round(m.carbs_g)}g`} label={s.carbsCaps} color={theme.macroCarbs} />
          <MacroPreviewTile theme={theme} value={`${Math.round(m.fat_g)}g`} label={s.fatCaps} color={theme.macroFat} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.s2, flexWrap: 'wrap' }}>
          {MEALS.map((x) => (
            <SelectChip key={x.id} theme={theme} label={x.label} selected={meal === x.id} compact testID={`meal-${x.id}`}
              tintedBg={x.id === 'breakfast' ? theme.softOrangeBg : undefined}
              tintedColor={x.id === 'breakfast' ? theme.macroProtein : undefined}
              onPress={() => setMeal(x.id)} />
          ))}
        </View>
        <CTAButton theme={theme} label={s.logTo(mealLabel, m.kcal)} testID="log-cta" onPress={() => p.onLog(grams, meal)} />
      </View>
    </Sheet>
  );
}
