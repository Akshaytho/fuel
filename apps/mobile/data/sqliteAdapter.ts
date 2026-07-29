/** expo-sqlite kv-store adapter for LogStore (ADR-008). */
import Storage from 'expo-sqlite/kv-store';
import type { StorageAdapter, LocalEntry, WaterStorageAdapter, WaterEntry } from '@fuel/store';

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
