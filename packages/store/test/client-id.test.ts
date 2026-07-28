import { describe, it, expect, afterEach } from 'vitest';
import { LogStore, MemoryAdapter, type NewEntry } from '../src/index';

/** RFC 4122 v4: 8-4-4-4-12 hex, version nibble 4, variant nibble 8|9|a|b. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const entry = (): NewEntry => ({
  day: '2026-07-28', food_id: null, food_name: 'Bananas, raw', grams: 100,
  kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3,
  source: 'search', logged_at: '2026-07-28T12:00:00Z',
});

const withoutWebCrypto = async (fn: () => Promise<void>) => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  try { await fn(); } finally {
    if (real) Object.defineProperty(globalThis, 'crypto', real);
    else delete (globalThis as { crypto?: unknown }).crypto;
  }
};

/**
 * P0 regression. `log_entries.client_id` is a Postgres `uuid` column. React
 * Native/Hermes ships no Web Crypto (Expo 54 installs TextDecoder/URL/
 * structuredClone but NOT crypto), so the fallback path is the ONLY path on
 * device — and it must still emit a real uuid. The previous fallback produced
 * `<hex-time>-<hex>-<hex>`, which Postgres rejects with 22P02, so every sync
 * 400'd and was swallowed by the catch in sync().
 *
 * The browser-based harness never caught this: Chromium HAS crypto.randomUUID.
 */
describe('client_id generation', () => {
  afterEach(() => { /* descriptor restored by withoutWebCrypto */ });

  it('is a valid v4 uuid when the runtime HAS crypto.randomUUID', async () => {
    const s = new LogStore(new MemoryAdapter());
    await s.init();
    expect((await s.add(entry())).client_id).toMatch(UUID_V4);
  });

  it('is a valid v4 uuid when the runtime has NO crypto (device path)', async () => {
    await withoutWebCrypto(async () => {
      const s = new LogStore(new MemoryAdapter());
      await s.init();
      expect((await s.add(entry())).client_id).toMatch(UUID_V4);
    });
  });

  it('stays unique across many ids on the device path', async () => {
    await withoutWebCrypto(async () => {
      const s = new LogStore(new MemoryAdapter());
      await s.init();
      const ids = new Set<string>();
      for (let i = 0; i < 5000; i += 1) ids.add((await s.add(entry())).client_id);
      expect(ids.size).toBe(5000);
    });
  });

  it('still honours an injected id generator', async () => {
    const s = new LogStore(new MemoryAdapter(), undefined, () => 'fixed-id');
    await s.init();
    expect((await s.add(entry())).client_id).toBe('fixed-id');
  });
});
