/**
 * Offline-first weigh-in store (spec 0009). One weight per local day —
 * mirrors the server PK (user_id, day), so re-logging the same day REPLACES
 * locally and upserts remotely. Unlike food/water (append-only events), a
 * weigh-in is a measurement: the latest value for the day is the truth.
 */

export interface WeighIn {
  day: string;        // YYYY-MM-DD local (localDayISO)
  kg: number;
  logged_at: string;  // ISO
  synced: boolean;
}

export type NewWeighIn = Omit<WeighIn, 'synced'>;

export interface WeighInStorageAdapter {
  load(): Promise<WeighIn[]>;
  save(entries: WeighIn[]): Promise<void>;
}

export interface WeighInRemote {
  /** Must upsert server-side on (user_id, day). Throws on failure. */
  push(entry: WeighIn): Promise<void>;
}

export class MemoryWeighInAdapter implements WeighInStorageAdapter {
  private data: WeighIn[] = [];
  async load() { return [...this.data]; }
  async save(entries: WeighIn[]) { this.data = entries.map((e) => ({ ...e })); }
}

export class WeighInStore {
  private entries: WeighIn[] = [];
  private initialized = false;

  constructor(
    private adapter: WeighInStorageAdapter,
    private remote?: WeighInRemote,
  ) {}

  async init(): Promise<void> {
    this.entries = await this.adapter.load();
    this.initialized = true;
  }

  private assertInit() {
    if (!this.initialized) throw new Error('WeighInStore.init() not called');
  }

  /** Set the day's weight (replaces any earlier value for that day). */
  async set(input: NewWeighIn): Promise<WeighIn> {
    this.assertInit();
    if (!Number.isFinite(input.kg) || input.kg < 25 || input.kg > 400) {
      throw new Error('weight out of range');
    }
    const entry: WeighIn = { ...input, kg: Math.round(input.kg * 10) / 10, synced: false };
    this.entries = this.entries.filter((e) => e.day !== input.day);
    this.entries.push(entry);
    await this.adapter.save(this.entries);
    return entry;
  }

  all(): WeighIn[] {
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
