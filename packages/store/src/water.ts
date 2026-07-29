/**
 * Offline-first water store (B-16: the Today water card used to show a
 * hardcoded 0 L with a dead "+ Add" button).
 *
 * Append-only entries with the same idempotency contract as LogStore
 * (ADR-008): every add gets a client_id, unique (user_id, client_id) server
 * side. A counter MUST be append-only rather than a per-day total — a
 * last-write-wins total would silently lose sips logged on a second device,
 * and a replayed sync would double-count.
 */
import { defaultId } from './index';

export interface WaterEntry {
  client_id: string;
  day: string;        // YYYY-MM-DD, local (localDayISO)
  ml: number;
  logged_at: string;  // ISO
  synced: boolean;
}

export type NewWaterEntry = Omit<WaterEntry, 'client_id' | 'synced'>;

export interface WaterStorageAdapter {
  load(): Promise<WaterEntry[]>;
  save(entries: WaterEntry[]): Promise<void>;
}

export interface WaterRemote {
  /** Must be idempotent server-side on client_id. Throws on failure. */
  push(entry: WaterEntry): Promise<void>;
}

export class MemoryWaterAdapter implements WaterStorageAdapter {
  private data: WaterEntry[] = [];
  async load() { return [...this.data]; }
  async save(entries: WaterEntry[]) { this.data = entries.map((e) => ({ ...e })); }
}

/** One tap = one glass. Single source of truth for the increment. */
export const GLASS_ML = 250;

export class WaterStore {
  private entries: WaterEntry[] = [];
  private initialized = false;

  constructor(
    private adapter: WaterStorageAdapter,
    private remote?: WaterRemote,
    private idGen: () => string = defaultId,
  ) {}

  async init(): Promise<void> {
    this.entries = await this.adapter.load();
    this.initialized = true;
  }

  private assertInit() {
    if (!this.initialized) throw new Error('WaterStore.init() not called');
  }

  async add(input: NewWaterEntry): Promise<WaterEntry> {
    this.assertInit();
    if (!(input.ml > 0)) throw new Error('water ml must be positive');
    const entry: WaterEntry = { ...input, client_id: this.idGen(), synced: false };
    this.entries.push(entry);
    await this.adapter.save(this.entries);
    return entry;
  }

  /** Undo the most recent add for a day (mis-taps happen). */
  async removeLast(day: string): Promise<boolean> {
    this.assertInit();
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      if (this.entries[i]!.day === day) {
        this.entries.splice(i, 1);
        await this.adapter.save(this.entries);
        return true;
      }
    }
    return false;
  }

  mlForDay(day: string): number {
    this.assertInit();
    return this.entries.reduce((sum, e) => (e.day === day ? sum + e.ml : sum), 0);
  }

  litersForDay(day: string): number {
    return Math.round(this.mlForDay(day) / 100) / 10; // 1 decimal
  }

  allEntries(): WaterEntry[] {
    this.assertInit();
    return [...this.entries];
  }

  async clear(): Promise<void> {
    this.assertInit();
    this.entries = [];
    await this.adapter.save(this.entries);
  }

  get pendingCount(): number {
    this.assertInit();
    return this.entries.filter((e) => !e.synced).length;
  }

  async sync(): Promise<{ pushed: number; remaining: number }> {
    this.assertInit();
    let pushed = 0;
    if (this.remote) {
      for (const e of this.entries) {
        if (e.synced) continue;
        try {
          await this.remote.push(e);
        } catch {
          break; // stay pending; retry next sync
        }
        e.synced = true;
        pushed += 1;
        await this.adapter.save(this.entries);
      }
    }
    return { pushed, remaining: this.pendingCount };
  }
}
