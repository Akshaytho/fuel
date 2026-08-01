import { describe, it, expect } from 'vitest';
import { LogStore, MemoryAdapter, type Remote, type LocalEntry, type NewEntry } from '../src/index';

const entry = (over: Partial<NewEntry> = {}): NewEntry => ({
  day: '2026-07-27', food_id: null, food_name: 'Banana', grams: 118,
  kcal: 105, protein_g: 1.3, carbs_g: 26.9, fat_g: 0.4,
  source: 'search', meal: 'lunch', logged_at: '2026-07-27T12:00:00Z', ...over,
});

class FlakyRemote implements Remote {
  calls: string[] = [];
  failNext = 0;
  async push(e: LocalEntry) {
    if (this.failNext > 0) { this.failNext -= 1; throw new Error('offline'); }
    this.calls.push(e.client_id);
  }
}

describe('LogStore (spec 0006)', () => {
  it('add() is instant and visible immediately', async () => {
    const s = new LogStore(new MemoryAdapter());
    await s.init();
    const e = await s.add(entry());
    expect(e.client_id).toBeTruthy();
    expect(s.entriesForDay('2026-07-27')).toHaveLength(1);
    expect(s.consumedForDay('2026-07-27').kcal).toBe(105);
  });

  it('day filtering separates days', async () => {
    const s = new LogStore(new MemoryAdapter());
    await s.init();
    await s.add(entry());
    await s.add(entry({ day: '2026-07-28', kcal: 200 }));
    expect(s.entriesForDay('2026-07-27')).toHaveLength(1);
    expect(s.consumedForDay('2026-07-28').kcal).toBe(200);
  });

  it('persists across restart (crash recovery)', async () => {
    const adapter = new MemoryAdapter();
    const s1 = new LogStore(adapter);
    await s1.init();
    await s1.add(entry());
    const s2 = new LogStore(adapter); // "app relaunch"
    await s2.init();
    expect(s2.entriesForDay('2026-07-27')).toHaveLength(1);
    expect(s2.pendingCount).toBe(1);
  });

  it('sync pushes pending, marks synced; second sync pushes nothing', async () => {
    const remote = new FlakyRemote();
    const s = new LogStore(new MemoryAdapter(), remote);
    await s.init();
    await s.add(entry());
    await s.add(entry({ food_name: 'Oats', kcal: 227 }));
    expect((await s.sync())).toEqual({ pushed: 2, remaining: 0 });
    expect((await s.sync())).toEqual({ pushed: 0, remaining: 0 });
    expect(remote.calls).toHaveLength(2);
  });

  it('ONE transient failure is absorbed by the in-pass retry (lifespan rule)', async () => {
    const remote = new FlakyRemote();
    const s = new LogStore(new MemoryAdapter(), remote);
    await s.init();
    await s.add(entry());
    remote.failNext = 1;                          // single blip
    expect((await s.sync())).toEqual({ pushed: 1, remaining: 0 });
    expect(remote.calls).toHaveLength(1);
  });

  it('a DOWN network (2+ consecutive failures) keeps the entry pending; later sync completes', async () => {
    const remote = new FlakyRemote();
    const s = new LogStore(new MemoryAdapter(), remote);
    await s.init();
    await s.add(entry());
    remote.failNext = 2;                          // both attempts die
    expect((await s.sync()).remaining).toBe(1);   // stayed local, no loss
    expect((await s.sync())).toEqual({ pushed: 1, remaining: 0 }); // back online
    expect(remote.calls).toHaveLength(1);
  });

  it('failure mid-batch keeps order and resumes from the failed entry', async () => {
    const remote = new FlakyRemote();
    const s = new LogStore(new MemoryAdapter(), remote);
    await s.init();
    const a = await s.add(entry({ food_name: 'A' }));
    const b = await s.add(entry({ food_name: 'B' }));
    remote.failNext = 0;
    // entry B's network is DOWN: both its attempts fail
    let n = 0;
    const orig = remote.push.bind(remote);
    remote.push = async (e) => { n += 1; if (n >= 2 && n <= 3) throw new Error('net'); return orig(e); };
    expect((await s.sync()).remaining).toBe(1);
    remote.push = orig;
    await s.sync();
    expect(remote.calls).toEqual([a.client_id, b.client_id]);
  });

  it('no remote configured → entries simply stay pending', async () => {
    const s = new LogStore(new MemoryAdapter());
    await s.init();
    await s.add(entry());
    expect((await s.sync())).toEqual({ pushed: 0, remaining: 1 });
  });

  it('throws if used before init (guards misuse)', async () => {
    const s = new LogStore(new MemoryAdapter());
    await expect(s.add(entry())).rejects.toThrow('init');
  });

  it('client_ids are unique across adds', async () => {
    const s = new LogStore(new MemoryAdapter());
    await s.init();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add((await s.add(entry())).client_id);
    expect(ids.size).toBe(50);
  });

  it('allEntries returns everything; clear() empties store and persists', async () => {
    const adapter = new MemoryAdapter();
    const s = new LogStore(adapter);
    await s.init();
    await s.add(entry());
    await s.add(entry({ day: '2026-07-28' }));
    expect(s.allEntries()).toHaveLength(2);
    await s.clear();
    expect(s.allEntries()).toHaveLength(0);
    const s2 = new LogStore(adapter); await s2.init();
    expect(s2.allEntries()).toHaveLength(0);
  });
});
