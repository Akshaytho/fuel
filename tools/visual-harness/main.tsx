import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { light } from '@fuel/tokens';
import type { LocalEntry, StorageAdapter, WaterEntry, WaterStorageAdapter, WeighIn, WeighInStorageAdapter } from '@fuel/store';
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
const waterAdapter: WaterStorageAdapter = {
  async load() { const r = window.localStorage.getItem('water'); return r ? JSON.parse(r) as WaterEntry[] : []; },
  async save(e) { window.localStorage.setItem('water', JSON.stringify(e)); },
};
const weighInAdapter: WeighInStorageAdapter = {
  async load() { const r = window.localStorage.getItem('weighins'); return r ? JSON.parse(r) as WeighIn[] : []; },
  async save(e) { window.localStorage.setItem('weighins', JSON.stringify(e)); },
};

function Chrome() {
  const [alertText, setAlert] = React.useState('none');
  (window as unknown as { __setAlert: (s: string) => void }).__setAlert = setAlert;
  return <Text testID="alert" style={{ color: '#fff', fontFamily: 'monospace' }}>alert: {alertText}</Text>;
}

function App() {
  // Phone-portrait layout: the frame IS the window (390×844, no desktop
  // chrome around it) so a headed browser at 390-wide reads as a device.
  return (
    <View style={{ backgroundColor: '#000', minHeight: 890 }}>
      <Chrome />
      <View style={{ width: 390, height: 844, overflow: 'hidden' }}>
        <AppRoot
          theme={light}
          kv={kv}
          entryAdapter={entryAdapter}
          waterAdapter={waterAdapter}
          weighInAdapter={weighInAdapter}
          supabaseUrl={process.env.SUPA_URL ?? ''}
          supabaseAnonKey={process.env.SUPA_ANON ?? ''}
          alert={(t, m) => (window as unknown as { __setAlert: (s: string) => void }).__setAlert(`${t}: ${m}`.slice(0, 60))}
          share={(name, text) => { (window as unknown as { __export?: string }).__export = text; }}
        />
      </View>
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
