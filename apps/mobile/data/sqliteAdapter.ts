/** expo-sqlite kv-store adapter for LogStore (ADR-008). */
import Storage from 'expo-sqlite/kv-store';
import type { StorageAdapter, LocalEntry, WaterStorageAdapter, WaterEntry, WeighInStorageAdapter, WeighIn } from '@fuel/store';
import { normalizeLogEntries, normalizeWaterEntries, normalizeWeighIns } from '@fuel/store';

const KEY = 'fuel.log_entries.v1';

export const sqliteAdapter: StorageAdapter = {
  async load() {
    // RC-4: NEVER parse-as-latest-type. Old builds' rows (no meal) and
    // corrupted blobs both pass through the validated migration boundary.
    return normalizeLogEntries(await Storage.getItem(KEY));
  },
  async save(entries: LocalEntry[]) {
    await Storage.setItem(KEY, JSON.stringify(entries));
  },
};

const WATER_KEY = 'fuel.water_entries.v1';

export const waterSqliteAdapter: WaterStorageAdapter = {
  async load() {
    return normalizeWaterEntries(await Storage.getItem(WATER_KEY));
  },
  async save(entries: WaterEntry[]) {
    await Storage.setItem(WATER_KEY, JSON.stringify(entries));
  },
};

const WEIGHIN_KEY = 'fuel.weigh_ins.v1';

export const weighInSqliteAdapter: WeighInStorageAdapter = {
  async load() {
    return normalizeWeighIns(await Storage.getItem(WEIGHIN_KEY));
  },
  async save(entries: WeighIn[]) {
    await Storage.setItem(WEIGHIN_KEY, JSON.stringify(entries));
  },
};
