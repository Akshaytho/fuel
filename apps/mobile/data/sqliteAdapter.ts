/** expo-sqlite kv-store adapter for LogStore (ADR-008). */
import Storage from 'expo-sqlite/kv-store';
import type { StorageAdapter, LocalEntry, WaterStorageAdapter, WaterEntry, WeighInStorageAdapter, WeighIn } from '@fuel/store';

const KEY = 'fuel.log_entries.v1';

export const sqliteAdapter: StorageAdapter = {
  async load() {
    const raw = await Storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalEntry[]) : [];
  },
  async save(entries: LocalEntry[]) {
    await Storage.setItem(KEY, JSON.stringify(entries));
  },
};

const WATER_KEY = 'fuel.water_entries.v1';

export const waterSqliteAdapter: WaterStorageAdapter = {
  async load() {
    const raw = await Storage.getItem(WATER_KEY);
    return raw ? (JSON.parse(raw) as WaterEntry[]) : [];
  },
  async save(entries: WaterEntry[]) {
    await Storage.setItem(WATER_KEY, JSON.stringify(entries));
  },
};

const WEIGHIN_KEY = 'fuel.weigh_ins.v1';

export const weighInSqliteAdapter: WeighInStorageAdapter = {
  async load() {
    const raw = await Storage.getItem(WEIGHIN_KEY);
    return raw ? (JSON.parse(raw) as WeighIn[]) : [];
  },
  async save(entries: WeighIn[]) {
    await Storage.setItem(WEIGHIN_KEY, JSON.stringify(entries));
  },
};
