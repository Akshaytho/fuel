import React, { useEffect, useMemo, useState } from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Theme } from '@fuel/tokens';
import {
  scalePer100g, summarizeDay, computeTargets, mealForHour,
  type Targets, type Meal, type Profile,
} from '@fuel/domain';
import { LogStore, type StorageAdapter } from '@fuel/store';
import { createAuth, type KV, type Auth } from '../data/auth';
import { createRemote, upsertProfile } from '../data/remote';
import { createSupabaseFoodRepo, type FoodHit } from '../data/foodRepo';
import { TodayScreen, type TodayVM } from './TodayScreen';
import { LogSheet, SearchScreen, PortionSheet } from './logflow';
import { WelcomeScreen, EmailAuthSheet, GoalScreen, AboutYouScreen, PlanScreen, goalToDomain, type AboutYou } from './onboarding';
import { ProfileScreen } from './ProfileScreen';
import { buildExportCSV } from '../data/exportData';
import { pf } from './profileStrings';
import { Sheet, CTAButton } from '@fuel/ui';
import { Text } from 'react-native';
import { onb } from './onbStrings';

/** The whole user journey (spec 0007). Injected deps so the SAME component
    runs on device (sqlite kv) and in the verification harness (web kv). */
export interface AppRootProps {
  theme: Theme;
  kv: KV;
  entryAdapter: StorageAdapter;
  supabaseUrl: string;
  supabaseAnonKey: string;
  alert: (title: string, message: string) => void;
  /** deliver export text to the user (device: share sheet; harness: capture) */
  share: (filename: string, text: string) => void;
}

interface StoredPlan { profile: Profile; targets: Targets; water_l: number; reminder: boolean; createdAt?: string }
const PROFILE_KEY = 'fuel.profile.v1';

type Stage = 'boot' | 'welcome' | 'goal' | 'about' | 'plan' | 'today' | 'profile';

export function AppRoot({ theme, kv, entryAdapter, supabaseUrl, supabaseAnonKey, alert, share }: AppRootProps) {
  const auth: Auth = useMemo(() => createAuth(supabaseUrl, supabaseAnonKey, kv), []);
  const store = useMemo(
    () => new LogStore(entryAdapter, createRemote(supabaseUrl, supabaseAnonKey, () => auth.session)),
    [],
  );
  const repo = useMemo(() => createSupabaseFoodRepo(supabaseUrl, supabaseAnonKey), []);

  const [stage, setStage] = useState<Stage>('boot');
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((x) => x + 1);

  // onboarding working state
  const [authOpen, setAuthOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>(undefined);
  const [goal, setGoal] = useState<string | null>(null);
  const [about, setAbout] = useState<AboutYou>({ sex: 'female', age: '', height: '', weight: '', activity: null });
  const [reminder, setReminder] = useState(true);

  // log-flow state
  const [sheet, setSheet] = useState<'none' | 'log' | 'search' | 'portion'>('none');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodHit[]>([]);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    (async () => {
      await store.init();
      await auth.init();                       // restore session if any
      const raw = await kv.getItem(PROFILE_KEY);
      if (raw && raw.length > 2) {
        setPlan(JSON.parse(raw) as StoredPlan);
        setStage('today');
        void store.sync().then(() => bump());  // background push of anything pending
      } else {
        setStage('welcome');
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    if (query.trim().length < 2) { setResults([]); return; }
    repo.search(query)
      .then((r) => { if (alive) { setResults(r); setSearchError(false); } })
      .catch(() => { if (alive) setSearchError(true); });
    return () => { alive = false; };
  }, [query]);

  const aboutProfile = (): Profile | null => {
    const age = Number(about.age), h = Number(about.height), w = Number(about.weight);
    if (!goal || !about.activity || !Number.isFinite(age) || !Number.isFinite(h) || !Number.isFinite(w)) return null;
    if (age < 13 || age > 120 || h < 90 || h > 250 || w < 25 || w > 400) return null;
    return { sex: about.sex, age_years: age, height_cm: h, weight_kg: w, activity: about.activity, goal: goalToDomain(goal) };
  };

  const finishOnboarding = async (targets: Targets, water_l: number) => {
    const profile = aboutProfile();
    if (!profile) return;
    const stored: StoredPlan = { profile, targets, water_l, reminder, createdAt: plan?.createdAt ?? new Date().toISOString() };
    await kv.setItem(PROFILE_KEY, JSON.stringify(stored));
    setPlan(stored);
    setStage('today');
    const s = auth.session;
    if (s) upsertProfile(supabaseUrl, supabaseAnonKey, s, profile, targets).catch(() => {});
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const vm: TodayVM = useMemo(() => {
    if (stage !== 'today' || !plan) return { kind: 'loading' };
    const targets = plan.targets;
    const day = todayISO();
    const entries = store.entriesForDay(day);
    const consumed = store.consumedForDay(day);
    const base = summarizeDay([], targets);
    return {
      kind: 'ready',
      dateLabel: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        + (entries.length === 0 ? ' · Day 1' : ''),
      offline: store.pendingCount > 0,
      targets,
      summary: {
        ...base, consumed,
        remaining: {
          kcal: Math.round(targets.kcal - consumed.kcal),
          protein_g: targets.protein_g - consumed.protein_g,
          carbs_g: targets.carbs_g - consumed.carbs_g,
          fat_g: targets.fat_g - consumed.fat_g,
        },
        progress: {
          kcal: consumed.kcal / targets.kcal,
          protein: consumed.protein_g / targets.protein_g,
          carbs: consumed.carbs_g / targets.carbs_g,
          fat: consumed.fat_g / targets.fat_g,
        },
        isOver: consumed.kcal > targets.kcal,
        entryCount: entries.length,
      },
      entries: entries.map((e) => ({
        id: e.client_id, title: e.food_name,
        subtitle: `${Math.round(e.grams)} g · ${Math.round(e.kcal)} kcal`,
        proteinLabel: `${Math.round(e.protein_g)}g`,
      })),
      streak: entries.length > 0 ? { days: 1, isLongest: false } : undefined,
      water: entries.length > 0 ? { liters: 0, goalLiters: plan.water_l } : undefined,
      coach: entries.length > 0
        ? `Nice — ${Math.max(0, Math.round(targets.protein_g - consumed.protein_g))} g protein to go.`
        : undefined,
    };
  }, [stage, plan, tick]);

  const logIt = async (grams: number, _meal: Meal) => {
    if (!picked) return;
    const per100 = {
      kcal: picked.kcal_per_100g, protein_g: picked.protein_g_per_100g,
      carbs_g: picked.carbs_g_per_100g, fat_g: picked.fat_g_per_100g,
    };
    await store.add({
      day: todayISO(), food_id: picked.id, food_name: picked.name, grams,
      ...scalePer100g(per100, grams), source: 'search', logged_at: new Date().toISOString(),
    });
    bump();
    setSheet('none'); setPicked(null); setQuery(''); setResults([]);
    await store.sync().catch(() => {});
    bump();
  };

  const emailAuth = async (email: string, password: string) => {
    setAuthBusy(true); setAuthError(undefined);
    try {
      try { await auth.signIn(email, password); }
      catch { await auth.signUp(email, password); }
      setAuthOpen(false);
      setStage('goal');
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Could not sign in');
    } finally { setAuthBusy(false); }
  };

  const comingSoon = () => alert(onb.comingSoonTitle, onb.comingSoonBody); // TODO(B-09): needs Harish's Apple/Google dev accounts
  const soon = (what: string) => () => alert(what, 'Arrives in Phase 2.'); // TODO(stub): P2

  const doExport = () => {
    if (!plan) return;
    const entries = store.allEntries();
    const csv = buildExportCSV(plan.profile, plan.targets, entries);
    share(`fuel-export-${todayISO()}.csv`, csv);
    alert(pf.exportedTitle, pf.exportedBody(entries.length));
  };

  const doSignOut = async () => {
    await auth.signOut();
    setStage('welcome');
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const s = auth.session;
      if (s) {
        const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${s.access_token}`, apikey: supabaseAnonKey },
        });
        if (!res.ok) throw new Error(`server delete failed: ${res.status}`);
      }
      await store.clear();
      await kv.setItem(PROFILE_KEY, '');
      await auth.signOut();
      setPlan(null);
      setConfirmDelete(false);
      setStage('welcome');
    } catch (e) {
      alert('Delete failed', e instanceof Error ? e.message : 'Try again.');
    } finally { setDeleting(false); }
  };

  if (stage === 'boot') return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  if (stage === 'welcome' || stage === 'goal' || stage === 'about' || stage === 'plan') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {stage === 'welcome' && (
          <WelcomeScreen theme={theme}
            onApple={comingSoon} onGoogle={comingSoon}
            onEmail={() => setAuthOpen(true)} onRestore={comingSoon} />
        )}
        {stage === 'goal' && (
          <GoalScreen theme={theme} value={goal} onSelect={setGoal} onContinue={() => setStage('about')} />
        )}
        {stage === 'about' && (
          <AboutYouScreen theme={theme} value={about} onChange={setAbout}
            valid={aboutProfile() !== null} onContinue={() => setStage('plan')} />
        )}
        {stage === 'plan' && aboutProfile() && (
          <PlanScreen theme={theme} profile={aboutProfile()!}
            reminder={reminder} onReminder={setReminder} onStart={finishOnboarding} />
        )}
        <Modal visible={authOpen} transparent animationType="slide" onRequestClose={() => setAuthOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setAuthOpen(false)} />
          <EmailAuthSheet theme={theme} busy={authBusy} error={authError} onSubmit={emailAuth} />
        </Modal>
      </View>
    );
  }

  if (stage === 'profile' && plan) {
    const days = new Set(store.allEntries().map((e) => e.day)).size;
    const since = new Date(plan.createdAt ?? Date.now())
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ProfileScreen theme={theme}
          vm={{
            name: auth.session?.email?.split('@')[0] ?? 'You',
            sinceLabel: `Fueling since ${since} · ${days} day${days === 1 ? '' : 's'} logged`,
            goal: plan.profile.goal, targets: plan.targets,
            reminderLabel: plan.reminder ? '9:00 PM' : 'Off',
            unitsLabel: 'kg, ml',
          }}
          onChangeGoal={() => setStage('goal')}
          onReminders={soon('Reminders')} onUnits={soon('Units')} onHealth={soon('Apple Health')}
          onExport={doExport} onHelp={soon('Help & FAQ')}
          onSignOut={doSignOut}
          onDeleteAccount={() => setConfirmDelete(true)}
          onTab={(i) => { if (i === 0) setStage('today'); }}
          onLog={() => { setStage('today'); setSheet('log'); }} />
        <Modal visible={confirmDelete} transparent animationType="slide" onRequestClose={() => setConfirmDelete(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setConfirmDelete(false)} />
          <Sheet theme={theme}>
            <View style={{ gap: 12 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: theme.label }}>{pf.deleteConfirmTitle}</Text>
              <Text style={{ fontSize: 15, color: theme.secondaryLabel }}>{pf.deleteConfirmBody}</Text>
              <View style={{ backgroundColor: theme.danger, borderRadius: 16 }}>
                <CTAButton theme={theme} testID="confirm-delete" label={deleting ? 'Deleting…' : pf.deleteConfirmCta} onPress={() => { if (!deleting) void doDelete(); }} />
              </View>
              <Pressable testID="cancel-delete" onPress={() => setConfirmDelete(false)} style={{ alignItems: 'center', padding: 8 }}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: theme.tint }}>{pf.cancel}</Text>
              </Pressable>
            </View>
          </Sheet>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <TodayScreen theme={theme} vm={vm}
        onLog={() => setSheet('log')}
        onScan={soon('Scan')} onDescribe={soon('Describe')}
        onTab={(i) => { if (i === 3) setStage('profile'); }}
        onProfile={() => setStage('profile')} />
      <Modal visible={sheet !== 'none'} transparent animationType="slide" onRequestClose={() => setSheet('none')}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setSheet('none')} />
        <View>
          {sheet === 'log' && (
            <LogSheet theme={theme} mealLabel={cap(mealForHour(new Date().getHours()))}
              goTos={[]}
              onSearchFocus={() => setSheet('search')}
              onScan={soon('Scan')} onDescribe={soon('Describe')} onLabel={soon('Label')}
              onSaved={soon('Saved')} onCopyYesterday={soon('Copy yesterday')} onQuickAdd={() => {}} />
          )}
          {sheet === 'search' && (
            <View style={{ height: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
              <SearchScreen theme={theme} query={query} error={searchError}
                results={results.map((r) => ({
                  id: r.id, name: r.name,
                  subtitle: `100 g · ${Math.round(r.kcal_per_100g)} kcal · ${Math.round(r.protein_g_per_100g)} g protein`,
                }))}
                onQuery={setQuery}
                onCancel={() => { setSheet('log'); setQuery(''); }}
                onAdd={(id) => { const f = results.find((x) => x.id === id); if (f) { setPicked(f); setSheet('portion'); } }}
                onDescribe={soon('Describe')} />
            </View>
          )}
          {sheet === 'portion' && picked && (
            <PortionSheet theme={theme} foodName={picked.name}
              usualNote={`per 100 g · ${Math.round(picked.kcal_per_100g)} kcal`}
              per100g={{
                kcal: picked.kcal_per_100g, protein_g: picked.protein_g_per_100g,
                carbs_g: picked.carbs_g_per_100g, fat_g: picked.fat_g_per_100g,
              }}
              options={[
                { label: '50 g', grams: 50 }, { label: '100 g', grams: 100 },
                { label: '150 g', grams: 150 }, { label: '200 g', grams: 200 },
              ]}
              initialIndex={1} initialMeal={mealForHour(new Date().getHours())}
              onEditFood={soon('Edit food')} onLog={logIt} />
          )}
        </View>
      </Modal>
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
