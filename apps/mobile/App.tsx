import React from 'react';
import { SafeAreaView, Alert, Share, useColorScheme } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { light, dark } from '@fuel/tokens';
import { AppRoot } from './screens/AppRoot';
import { sqliteAdapter, waterSqliteAdapter } from './data/sqliteAdapter';

const kv = {
  getItem: (k: string) => Storage.getItem(k),
  setItem: (k: string, v: string) => Storage.setItem(k, v),
};

export default function App() {
  const theme = useColorScheme() === 'dark' ? dark : light;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppRoot
        theme={theme}
        kv={kv}
        entryAdapter={sqliteAdapter}
        waterAdapter={waterSqliteAdapter}
        supabaseUrl={process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}
        supabaseAnonKey={process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''}
        alert={(t, m) => Alert.alert(t, m)}
        share={(name, text) => { void Share.share({ title: name, message: text }); }}
      />
    </SafeAreaView>
  );
}
