import { describe, it, expect } from 'vitest';
import { WeighInStore, MemoryWeighInAdapter, type WeighIn } from '../src/weighins';

const mk = async (remote?: { push: (e: WeighIn) => Promise<void> }) => {
  const s = new WeighInStore(new MemoryWeighInAdapter(), remote);
  await s.init();
  return s;
};
const at = '2026-08-01T07:00:00.000Z';

describe('WeighInStore (spec 0009: one measurement per day)', () => {
  it('stores a weight rounded to 0.1 kg', async () => {
    const s = await mk();
    const e = await s.set({ day: '2026-08-01', kg: 70.27, logged_at: at });
    expect(e.kg).toBe(70.3);
    expect(s.all()).toHaveLength(1);
  });

  it('re-logging the same day REPLACES (measurement, not event)', async () => {
    const s = await mk();
    await s.set({ day: '2026-08-01', kg: 71, logged_at: at });
    await s.set({ day: '2026-08-01', kg: 70.5, logged_at: at });
    expect(s.all()).toHaveLength(1);
    expect(s.all()[0]!.kg).toBe(70.5);
    expect(s.all()[0]!.synced).toBe(false); // replacement must re-sync
  });

  it('different days accumulate', async () => {
    const s = await mk();
    await s.set({ day: '2026-07-31', kg: 71, logged_at: at });
    await s.set({ day: '2026-08-01', kg: 70.8, logged_at: at });
    expect(s.all()).toHaveLength(2);
  });

  it('rejects out-of-range and non-finite weights (profile bounds)', async () => {
    const s = await mk();
    for (const bad of [0, 24.9, 401, NaN, Infinity]) {
      await expect(s.set({ day: 'd', kg: bad, logged_at: at })).rejects.toThrow();
    }
  });

  it('sync pushes pending, halts on failure, resumes idempotently', async () => {
    let fail = true;
    const pushed: Array<{ day: string; kg: number }> = [];
    const s = await mk({
      async push(e) { if (fail) throw new Error('offline'); pushed.push({ day: e.day, kg: e.kg }); },
    });
    await s.set({ day: '2026-07-31', kg: 71, logged_at: at });
    await s.set({ day: '2026-08-01', kg: 70.8, logged_at: at });
    expect((await s.sync()).pushed).toBe(0);
    expect(s.pendingCount).toBe(2);
    fail = false;
    expect((await s.sync()).pushed).toBe(2);
    expect((await s.sync()).pushed).toBe(0);
    expect(pushed).toHaveLength(2);
  });

  it('same-day correction pushes the NEW value after replacement', async () => {
    const pushed: number[] = [];
    const s = await mk({ async push(e) { pushed.push(e.kg); } });
    await s.set({ day: '2026-08-01', kg: 71, logged_at: at });
    await s.sync();
    await s.set({ day: '2026-08-01', kg: 70.5, logged_at: at });
    await s.sync();
    expect(pushed).toEqual([71, 70.5]); // server upsert makes the 2nd a replace
  });

  it('clear wipes everything (GDPR delete path)', async () => {
    const s = await mk();
    await s.set({ day: '2026-08-01', kg: 70, logged_at: at });
    await s.clear();
    expect(s.all()).toEqual([]);
  });
});
