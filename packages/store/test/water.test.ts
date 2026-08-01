import { describe, it, expect } from 'vitest';
import { WaterStore, MemoryWaterAdapter, GLASS_ML, type WaterEntry } from '../src/water';

const mk = async (remote?: { push: (e: WaterEntry) => Promise<void> }) => {
  const s = new WaterStore(new MemoryWaterAdapter(), remote);
  await s.init();
  return s;
};
const now = '2026-07-28T10:00:00.000Z';

describe('WaterStore (B-16: real water, not a hardcoded 0)', () => {
  it('starts empty — a new day is genuinely 0, not fabricated', async () => {
    const s = await mk();
    expect(s.mlForDay('2026-07-28')).toBe(0);
    expect(s.litersForDay('2026-07-28')).toBe(0);
  });

  it('sums glasses within a day and keeps days separate', async () => {
    const s = await mk();
    await s.add({ day: '2026-07-28', ml: GLASS_ML, logged_at: now });
    await s.add({ day: '2026-07-28', ml: GLASS_ML, logged_at: now });
    await s.add({ day: '2026-07-27', ml: GLASS_ML, logged_at: now });
    expect(s.mlForDay('2026-07-28')).toBe(500);
    expect(s.litersForDay('2026-07-28')).toBe(0.5);
    expect(s.mlForDay('2026-07-27')).toBe(250);
  });

  it('rounds litres to one decimal', async () => {
    const s = await mk();
    for (let i = 0; i < 5; i += 1) await s.add({ day: 'd', ml: GLASS_ML, logged_at: now });
    expect(s.litersForDay('d')).toBe(1.3); // 1250 ml
  });

  it('rejects non-positive amounts', async () => {
    const s = await mk();
    await expect(s.add({ day: 'd', ml: 0, logged_at: now })).rejects.toThrow();
    await expect(s.add({ day: 'd', ml: -250, logged_at: now })).rejects.toThrow();
  });

  it('undo removes only the latest entry for that day', async () => {
    const s = await mk();
    await s.add({ day: 'a', ml: 250, logged_at: now });
    await s.add({ day: 'b', ml: 250, logged_at: now });
    await s.add({ day: 'a', ml: 250, logged_at: now });
    expect(await s.removeLast('a')).toBeTruthy();
    expect(s.mlForDay('a')).toBe(250);
    expect(s.mlForDay('b')).toBe(250);
    expect(await s.removeLast('zzz')).toBeNull();
  });

  it('every entry gets a distinct RFC-4122 client_id (device path safe)', async () => {
    const s = await mk();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const e = await s.add({ day: 'd', ml: 250, logged_at: now });
      expect(e.client_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      ids.add(e.client_id);
    }
    expect(ids.size).toBe(50);
  });

  it('sync pushes pending, stops at failure, and resumes without double-count', async () => {
    let fail = true;
    const pushed: string[] = [];
    const s = await mk({
      async push(e) {
        if (fail) throw new Error('offline');
        pushed.push(e.client_id);
      },
    });
    await s.add({ day: 'd', ml: 250, logged_at: now });
    await s.add({ day: 'd', ml: 250, logged_at: now });
    expect((await s.sync()).pushed).toBe(0);
    expect(s.pendingCount).toBe(2);
    expect(s.mlForDay('d')).toBe(500); // local total unaffected by network

    fail = false;
    expect((await s.sync()).pushed).toBe(2);
    expect(s.pendingCount).toBe(0);
    expect((await s.sync()).pushed).toBe(0);   // replay is a no-op
    expect(pushed.length).toBe(2);
    expect(s.mlForDay('d')).toBe(500);
  });

  it('clear wipes everything (GDPR delete path)', async () => {
    const s = await mk();
    await s.add({ day: 'd', ml: 250, logged_at: now });
    await s.clear();
    expect(s.allEntries()).toEqual([]);
    expect(s.mlForDay('d')).toBe(0);
  });
});
