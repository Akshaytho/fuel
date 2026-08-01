/**
 * Rule 0c at the STORE layer: two years of real usage through the actual
 * LogStore / WaterStore / WeighInStore, over a network that fails the way
 * real networks fail. The accounting must be EXACT — after 730 days, every
 * entry pushed exactly once, nothing lost, nothing duplicated.
 */
import { describe, it, expect } from 'vitest';
import { LogStore, MemoryAdapter, type LocalEntry, type NewEntry } from '../src/index';
import { WaterStore, MemoryWaterAdapter, GLASS_ML } from '../src/water';
import { WeighInStore, MemoryWeighInAdapter } from '../src/weighins';

const DAYS = 730;
const day = (i: number) => {
  const d = new Date(Date.UTC(2026, 7, 1 + i));
  return d.toISOString().slice(0, 10);
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const meal = (i: number) => (['breakfast', 'lunch', 'dinner', 'snack'] as const)[i % 4]!;
const entry = (d: string, i: number): NewEntry => ({
  day: d, food_id: null, food_name: `food-${i}`, grams: 100 + (i % 200),
  kcal: 80 + (i % 400), protein_g: (i % 40), carbs_g: (i % 60), fat_g: (i % 20),
  source: 'search', meal: meal(i), logged_at: `${d}T12:00:00.000Z`,
});

describe('two years of logging over a flaky network', () => {
  it('every entry reaches the server EXACTLY once; queue fully drains', async () => {
    const rand = rng(7);
    const pushed: string[] = [];
    let failuresInjected = 0;
    const store = new LogStore(new MemoryAdapter(), {
      async push(e: LocalEntry) {
        if (rand() < 0.15) { failuresInjected += 1; throw new Error('flaky'); }
        pushed.push(e.client_id);
      },
    });
    await store.init();

    let added = 0;
    for (let i = 0; i < DAYS; i += 1) {
      const d = day(i);
      const mealsToday = 2 + Math.floor(rand() * 3);       // 2–4 meals, like a person
      for (let m = 0; m < mealsToday; m += 1) {
        await store.add(entry(d, i * 10 + m));
        added += 1;
      }
      if (i % 3 === 0) await store.sync();                 // syncs whenever the app opens
    }
    // final drain — keep syncing like the app does on each open
    for (let k = 0; k < 50 && store.pendingCount > 0; k += 1) await store.sync();

    expect(failuresInjected).toBeGreaterThan(50);          // the network really was hostile
    expect(store.pendingCount).toBe(0);
    expect(pushed.length).toBe(added);                     // exactly once each
    expect(new Set(pushed).size).toBe(added);              // no duplicate ids
    expect(store.allEntries().length).toBe(added);
  }, 30000);

  it('day queries stay correct and fast with ~2,200 entries in memory', async () => {
    const store = new LogStore(new MemoryAdapter());
    await store.init();
    for (let i = 0; i < DAYS; i += 1) {
      await store.add(entry(day(i), i));
      if (i % 2 === 0) await store.add(entry(day(i), i + 5000));
    }
    const probe = day(400);
    const t0 = performance.now();
    for (let k = 0; k < 100; k += 1) store.consumedForDay(probe); // 100 renders' worth
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(300);
    const c = store.consumedForDay(probe);
    const expected = [entry(probe, 400), entry(probe, 5400)];
    expect(c.kcal).toBe(Math.round(expected.reduce((s, e) => s + (e.kcal * e.grams) / 100, 0)));
  }, 30000);
});

describe('two years of water and weigh-ins', () => {
  it('water: 2 glasses/day × 730 days totals exactly per-day, never bleeding across days', async () => {
    const w = new WaterStore(new MemoryWaterAdapter());
    await w.init();
    for (let i = 0; i < DAYS; i += 1) {
      await w.add({ day: day(i), ml: GLASS_ML, logged_at: `${day(i)}T08:00:00Z` });
      await w.add({ day: day(i), ml: GLASS_ML, logged_at: `${day(i)}T20:00:00Z` });
    }
    expect(w.allEntries().length).toBe(DAYS * 2);
    expect(w.mlForDay(day(100))).toBe(500);
    expect(w.mlForDay(day(729))).toBe(500);
    expect(w.litersForDay(day(365))).toBe(0.5);
  }, 30000);

  it('weigh-ins: daily for two years with weekly corrections stays one-row-per-day', async () => {
    const s = new WeighInStore(new MemoryWeighInAdapter());
    await s.init();
    for (let i = 0; i < DAYS; i += 1) {
      await s.set({ day: day(i), kg: 80 - i * 0.01, logged_at: `${day(i)}T07:00:00Z` });
      if (i % 7 === 0) {
        await s.set({ day: day(i), kg: 80 - i * 0.01 + 0.2, logged_at: `${day(i)}T07:05:00Z` }); // stepped off, stepped back on
      }
    }
    expect(s.all().length).toBe(DAYS);                     // corrections never duplicated a day
    const days = s.all().map((e) => e.day);
    expect(new Set(days).size).toBe(DAYS);
  }, 30000);
});
