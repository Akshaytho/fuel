/** Offline-first log store (spec 0006, ADR-008). Pure TS — no platform imports. */
import { Macros, sumMacros } from '@fuel/domain';

export * from './water';
export * from './migrate';
export * from './weighins';

export interface LocalEntry extends Macros {
  client_id: string;
  day: string;                 // YYYY-MM-DD
  food_id: string | null;
  food_name: string;
  grams: number;
  source: 'scan' | 'describe' | 'search' | 'manual';
  /** which meal the user picked in the portion sheet (B-12: was dropped) */
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  logged_at: string;           // ISO
  /** spec 0015: fibre for this portion. null/absent = the food had no figure.
      Deliberately NOT part of Macros, because Macros cannot express "unknown". */
  fiber_g?: number | null | undefined;
  synced: boolean;
}

export type NewEntry = Omit<LocalEntry, 'client_id' | 'synced'>;

export interface StorageAdapter {
  load(): Promise<LocalEntry[]>;
  save(entries: LocalEntry[]): Promise<void>;
}

export interface Remote {
  /** Must be idempotent server-side on client_id. Throws on failure. */
  push(entry: LocalEntry): Promise<void>;
}

export class MemoryAdapter implements StorageAdapter {
  private data: LocalEntry[] = [];
  async load() { return [...this.data]; }
  async save(entries: LocalEntry[]) { this.data = entries.map((e) => ({ ...e })); }
}

export class LogStore {
  private entries: LocalEntry[] = [];
  private initialized = false;

  constructor(
    private adapter: StorageAdapter,
    private remote?: Remote,
    private idGen: () => string = defaultId,
  ) {}

  async init(): Promise<void> {
    this.entries = await this.adapter.load();
    this.initialized = true;
  }

  private assertInit() {
    if (!this.initialized) throw new Error('LogStore.init() not called');
  }

  /** Instant local write — never waits on network. */
  async add(input: NewEntry): Promise<LocalEntry> {
    this.assertInit();
    const entry: LocalEntry = { ...input, client_id: this.idGen(), synced: false };
    this.entries.push(entry);
    await this.adapter.save(this.entries);
    return entry;
  }

  allEntries(): LocalEntry[] {
    this.assertInit();
    return [...this.entries];
  }

  async clear(): Promise<void> {
    this.assertInit();
    this.entries = [];
    await this.adapter.save(this.entries);
  }

  /** Remove one entry (mislogged food). Returns it so the caller can mirror
      the deletion to the server; null if not found. */
  async remove(client_id: string): Promise<LocalEntry | null> {
    this.assertInit();
    const i = this.entries.findIndex((e) => e.client_id === client_id);
    if (i < 0) return null;
    const [removed] = this.entries.splice(i, 1);
    await this.adapter.save(this.entries);
    return removed ?? null;
  }

  /** Put back an entry whose remote deletion failed — local must not lie. */
  async restore(entry: LocalEntry): Promise<void> {
    this.assertInit();
    this.entries.push({ ...entry });
    await this.adapter.save(this.entries);
  }

  /** RC-1 (D-6): hydrate from the server on sign-in — a new phone must show
      the user's real history, not force a fake Day 1. Replaces everything. */
  async replaceAll(entries: LocalEntry[]): Promise<void> {
    this.assertInit();
    this.entries = entries.map((e) => ({ ...e }));
    await this.adapter.save(this.entries);
  }

  entriesForDay(day: string): LocalEntry[] {
    this.assertInit();
    return this.entries.filter((e) => e.day === day);
  }

  consumedForDay(day: string): Macros {
    return sumMacros(this.entriesForDay(day));
  }

  get pendingCount(): number {
    this.assertInit();
    return this.entries.filter((e) => !e.synced).length;
  }

  /**
   * Push unsynced entries in logged order. Stops at first failure (entry
   * stays pending; re-running sync resumes). Safe to call repeatedly.
   */
  async sync(): Promise<{ pushed: number; remaining: number }> {
    this.assertInit();
    let pushed = 0;
    if (this.remote) {
      for (const e of this.entries) {
        if (e.synced) continue;
        try {
          await this.remote.push(e);
        } catch {
          // One immediate retry: pushes are idempotent on the server key, so
          // this is safe, and it turns "15% flaky = 7 entries per app open"
          // into a queue that actually drains (rule 0c lifespan finding).
          try {
            await this.remote.push(e);
          } catch {
            break; // twice-failed → network likely down; retry next sync
          }
        }
        e.synced = true;
        pushed += 1;
        await this.adapter.save(this.entries);
      }
    }
    return { pushed, remaining: this.pendingCount };
  }
}

export function defaultId(): string {
  const c: Crypto | undefined = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // React Native/Hermes ships no Web Crypto (Expo 54 installs TextDecoder, URL
  // and structuredClone, but not crypto), so on device this IS the only path.
  // It must emit a real RFC 4122 v4: log_entries.client_id is a Postgres `uuid`
  // column and rejects anything else with 22P02 — which sync() swallows, so a
  // malformed id silently means "nothing ever reaches the server".
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
