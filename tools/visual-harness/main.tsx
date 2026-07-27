import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { light } from '@fuel/tokens';
import type { LocalEntry, StorageAdapter } from '@fuel/store';
import { AppRoot } from '../../apps/mobile/screens/AppRoot';

/* Journey harness (spec 0007 AC1): the REAL AppRoot with web-persistent
   storage (localStorage) + REAL Supabase auth/search/sync. */

declare const process: { env: Record<string, string | undefined> };

const kv = {
  getItem: async (k: string) => window.localStorage.getItem(k),
  setItem: async (k: string, v: string) => { window.localStorage.setItem(k, v); },
};
const entryAdapter: StorageAdapter = {
  async load() { const r = window.localStorage.getItem('entries'); return r ? JSON.parse(r) as LocalEntry[] : []; },
  async save(e) { window.localStorage.setItem('entries', JSON.stringify(e)); },
};

function Chrome() {
  const [alertText, setAlert] = React.useState('none');
  (window as unknown as { __setAlert: (s: string) => void }).__setAlert = setAlert;
  return <Text testID="alert" style={{ color: '#fff', fontFamily: 'monospace' }}>alert: {alertText}</Text>;
}

function App() {
  return (
    <View style={{ backgroundColor: '#5a5a5e', padding: 24, gap: 12, minHeight: 940 }}>
      <Chrome />
      <View style={{ width: 390, height: 844, borderRadius: 24, overflow: 'hidden' }}>
        <AppRoot
          theme={light}
          kv={kv}
          entryAdapter={entryAdapter}
          supabaseUrl={process.env.SUPA_URL ?? ''}
          supabaseAnonKey={process.env.SUPA_ANON ?? ''}
          alert={(t, m) => (window as unknown as { __setAlert: (s: string) => void }).__setAlert(`${t}: ${m}`.slice(0, 60))}
        />
      </View>
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
