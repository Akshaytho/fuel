/** RC-4 proof: bytes from ANY app version (or corruption) load without crash. */
import { describe, it, expect } from 'vitest';
import {
  normalizeLogEntries, normalizeWaterEntries, normalizeWeighIns, normalizeStoredPlan,
} from '../src/migrate';

describe('D-2: pre-B-12 entries (no meal field) load and infer a meal', () => {
  const legacy = JSON.stringify([{
    client_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', day: '2026-07-27',
    food_id: null, food_name: 'Banana', grams: 118, kcal: 105,
    protein_g: 1.3, carbs_g: 26.9, fat_g: 0.4, source: 'search',
    logged_at: '2026-07-27T08:30:00.000Z', synced: true,
    // NOTE: no `meal` key — exactly what the old build persisted
  }]);

  it('loads without throwing and meal is a valid value, never undefined', () => {
    const rows = normalizeLogEntries(legacy);
    expect(rows).toHaveLength(1);
    expect(['breakfast', 'lunch', 'dinner', 'snack']).toContain(rows[0]!.meal);
    expect(rows[0]!.meal).toBe('breakfast'); // 08:30 logged_at → breakfast
  });

  it('the crash scenario itself: cap(meal) works on every loaded row', () => {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    for (const r of normalizeLogEntries(legacy)) {
      expect(() => cap(r.meal)).not.toThrow();
      expect(cap(r.meal)).toBe('Breakfast');
    }
  });
});

describe('D-13: corruption never crashes, never hangs boot', () => {
  const garbage = ['not json {{{', '"a string"', '123', '{"a":1}', '[{"day":42}]', '[null, 7, "x"]', ''];
  it.each(garbage)('garbage %# → empty store, no throw', (g) => {
    expect(() => normalizeLogEntries(g)).not.toThrow();
    expect(normalizeLogEntries(g)).toEqual([]);
    expect(normalizeWaterEntries(g)).toEqual([]);
    expect(normalizeWeighIns(g)).toEqual([]);
  });

  it('one poisoned row is dropped; healthy rows survive', () => {
    const mixed = JSON.stringify([
      { client_id: 'ok-1', day: '2026-08-01', kcal: 100, logged_at: '2026-08-01T12:00:00Z' },
      { client_id: '', day: '2026-08-01' },            // no id → dropped
      { client_id: 'ok-2', day: 'yesterday' },         // bad day → dropped
      null, 42,
    ]);
    const rows = normalizeLogEntries(mixed);
    expect(rows.map((r) => r.client_id)).toEqual(['ok-1']);
  });

  it('malformed StoredPlan returns null (→ onboarding), never a throw', () => {
    for (const g of ['{{{', '{"profile":null}', '{"profile":{},"targets":{}}', '']) {
      expect(() => normalizeStoredPlan(g)).not.toThrow();
      expect(normalizeStoredPlan(g)).toBeNull();
    }
  });
});

describe('D-7: plan without createdAt backfills from oldest entry, not "now"', () => {
  const legacyPlan = JSON.stringify({
    profile: { sex: 'male', age_years: 30, height_cm: 178, weight_kg: 80, activity: 'light', goal: 'lose' },
    targets: { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 60, clamped: false },
    water_l: 2.75, reminder: true,
    // NOTE: no createdAt — pre-B-17 shape
  });

  it('createdAt = oldest entry day → Day N stays honest for legacy users', () => {
    const plan = normalizeStoredPlan(legacyPlan, '2026-02-10');
    expect(plan).not.toBeNull();
    expect(plan!.createdAt).toBe('2026-02-10T00:00:00.000Z');
  });

  it('with no entries either, falls back to now (true new user)', () => {
    const plan = normalizeStoredPlan(legacyPlan);
    expect(plan!.createdAt.slice(0, 4)).toBe(new Date().toISOString().slice(0, 4));
  });

  it('a modern plan keeps its own createdAt untouched', () => {
    const modern = JSON.stringify({ ...JSON.parse(legacyPlan), createdAt: '2026-01-01T00:00:00.000Z' });
    expect(normalizeStoredPlan(modern, '2026-05-05')!.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('weigh-in duplicates from any historical bug collapse to one per day', () => {
  it('keeps the first occurrence only', () => {
    const dup = JSON.stringify([
      { day: '2026-08-01', kg: 70, logged_at: 'x', synced: true },
      { day: '2026-08-01', kg: 71, logged_at: 'y', synced: false },
    ]);
    expect(normalizeWeighIns(dup)).toHaveLength(1);
  });
});
