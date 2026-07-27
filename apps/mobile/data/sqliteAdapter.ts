/** expo-sqlite kv-store adapter for LogStore (ADR-008). */
import Storage from 'expo-sqlite/kv-store';
import type { StorageAdapter, LocalEntry } from '@fuel/store';

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
