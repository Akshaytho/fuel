import React, { useEffect, useMemo, useState } from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Theme } from '@fuel/tokens';
import {
  scalePer100g, summarizeConsumed, computeTargets, mealForHour, localDayISO,
  computeStreak, dayNumber, waterLitersFor,
  type Targets, type Meal, type Profile,
} from '@fuel/domain';
import { LogStore, WaterStore, GLASS_ML, type StorageAdapter, type WaterStorageAdapter } from '@fuel/store';
import { createAuth, type KV, type Auth } from '../data/auth';
import { createRemote, createWaterRemote, upsertProfile, deleteAccount } from '../data/remote';
import { createSupabaseFoodRepo, type FoodHit } from '../data/foodRepo';
import { TodayScreen, type TodayVM } from './TodayScreen';
import { LogSheet, SearchScreen, PortionSheet } from './logflow';
import { WelcomeScreen, EmailAuthSheet, GoalScreen, AboutYouScreen, PlanScreen, goalToDomain, type AboutYou } from './onboarding';
import { ProfileScreen } from './ProfileScreen';
import { buildExportCSV } from '../data/exportData';
import { pf } from './profileStrings';
import { Sheet, CTAButton, BootSplash, FadeSlideIn } from '@fuel/ui';
import { Text } from 'react-native';
import { onb } from './onbStrings';
import { str } from './strings';

/** Only claim "no connection" when the platform actually says so (B-19). */
function isOnline(): boolean {
  const n = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  return n?.onLine !== false;
}

/** The whole user journey (spec 0007). Injected deps so the SAME component
    runs on device (sqlite kv) and in the verification harness (web kv). */
export interface AppRootProps {
  theme: Theme;
  kv: KV;
  entryAdapter: StorageAdapter;
  waterAdapter: WaterStorageAdapter;
  supabaseUrl: string;
  supabaseAnonKey: string;
  alert: (title: string, message: string) => void;
  /** deliver export text to the user (device: share sheet; harness: capture) */
  share: (filename: string, text: string) => void;
}

interface StoredPlan { profile: Profile; targets: Targets; water_l: number; reminder: boolean; createdAt?: string }
const PROFILE_KEY = 'fuel.profile.v1';

type Stage = 'boot' | 'welcome' | 'goal' | 'about' | 'plan' | 'today' | 'profile';

export function AppRoot({ theme, kv, entryAdapter, waterAdapter, supabaseUrl, supabaseAnonKey, alert, share }: AppRootProps) {
  const auth: Auth = useMemo(() => createAuth(supabaseUrl, supabaseAnonKey, kv), []);
  const store = useMemo(
    () => new LogStore(entryAdapter, createRemote(supabaseUrl, supabaseAnonKey, auth)),
    [],
  );
  const water = useMemo(
    () => new WaterStore(waterAdapter, createWaterRemote(supabaseUrl, supabaseAnonKey, auth)),
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
  const [searching, setSearching] = useState(false);
  // B-19: a failed push used to vanish into `catch {}` and show the same
  // "Offline" pill as a queued one. Track the real outcome.
  const [syncFailed, setSyncFailed] = useState(false);

  const runSync = async () => {
    try {
      await store.sync();
      await water.sync();
      setSyncFailed(store.pendingCount > 0 || water.pendingCount > 0);
    } catch { setSyncFailed(true); }
    bump();
  };

  useEffect(() => {
    (async () => {
      const t0 = Date.now();
      await store.init();
      await water.init();
      await auth.init();                       // restore session if any
      const raw = await kv.getItem(PROFILE_KEY);
      const returning = !!raw && raw.length > 2;
      if (returning) setPlan(JSON.parse(raw!) as StoredPlan);
      // Rule 0b: app open is a brand MOMENT — hold the splash long enough
      // for its spring to land, never a static flash (min 1400 ms).
      const hold = Math.max(0, 1400 - (Date.now() - t0));
      setTimeout(() => {
        setStage(returning ? 'today' : 'welcome');
        if (returning) void runSync();                       // background push
      }, hold);
    })();
  }, []);

  // B-20: debounced — typing "banana" used to fire SIX queries, each racing
  // the last. One query 250 ms after the user stops, and a stale response can
  // never overwrite a newer one.
  useEffect(() => {
    let alive = true;
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      repo.search(query)
        .then((r) => { if (alive) { setResults(r); setSearchError(false); setSearching(false); } })
        .catch(() => { if (alive) { setSearchError(true); setSearching(false); } });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
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
    if (auth.session) upsertProfile(supabaseUrl, supabaseAnonKey, auth, profile, targets).catch(() => {});
  };

  // LOCAL calendar day — must match the date rendered in the header below.
  // (Was toISOString(), i.e. UTC, which filed after-midnight logs under yesterday.)
  const todayISO = () => localDayISO();

  const vm: TodayVM = useMemo(() => {
    if (stage !== 'today' || !plan) return { kind: 'loading' };
    const targets = plan.targets;
    const day = todayISO();
    const entries = store.entriesForDay(day);
    // B-21 fix: the DISPLAYED numbers come from the same unit-tested domain
    // function the suite exercises — no parallel inline math to drift.
    const summary = summarizeConsumed(store.consumedForDay(day), entries.length, targets);
    // B-17: the day number comes from when this user actually started, so a
    // 6-month user with an empty day sees "Day 184", never "Day 1" again.
    const startDay = localDayISO(new Date(plan.createdAt ?? Date.now()));
    // B-16: streak computed from the real distinct logged days.
    const streak = computeStreak(store.allEntries().map((e) => e.day), day);
    const pending = store.pendingCount + water.pendingCount;
    return {
      kind: 'ready',
      dateLabel: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        + ` · ${str.dayN(dayNumber(startDay, day))}`,
      sync: {
        state: pending === 0 ? 'synced' : !isOnline() ? 'offline' : syncFailed ? 'failed' : 'pending',
        pending,
      },
      // B-18: real initial from the signed-in account (was a hardcoded "A").
      initial: (auth.session?.email?.trim()?.[0] ?? '·').toUpperCase(),
      targets,
      summary,
      entries: entries.map((e) => ({
        id: e.client_id, title: e.food_name,
        subtitle: `${cap(e.meal)} · ${Math.round(e.grams)} g · ${Math.round(e.kcal)} kcal`,
        proteinLabel: `${Math.round(e.protein_g)}g`,
      })),
      streak,
      // B-16: the actual litres this user logged today (was always 0).
      water: { liters: water.litersForDay(day), goalLiters: plan.water_l },
      coach: entries.length > 0
        ? `Nice — ${Math.max(0, Math.round(summary.remaining.protein_g))} g protein to go.`
        : undefined,
    };
  }, [stage, plan, tick]);

  const logIt = async (grams: number, meal: Meal) => {
    if (!picked) return;
    const per100 = {
      kcal: picked.kcal_per_100g, protein_g: picked.protein_g_per_100g,
      carbs_g: picked.carbs_g_per_100g, fat_g: picked.fat_g_per_100g,
    };
    await store.add({
      day: todayISO(), food_id: picked.id, food_name: picked.name, grams,
      ...scalePer100g(per100, grams), source: 'search', meal, logged_at: new Date().toISOString(),
    });
    bump();
    setSheet('none'); setPicked(null); setQuery(''); setResults([]);
    await runSync();
  };

  const addWater = async () => {
    await water.add({ day: todayISO(), ml: GLASS_ML, logged_at: new Date().toISOString() });
    bump();
    await runSync();
  };
  const undoWater = async () => {
    if (await water.removeLast(todayISO())) bump();
  };

  const emailAuth = async (email: string, password: string) => {
    setAuthBusy(true); setAuthError(undefined);
    try {
      await auth.signIn(email, password);
      setAuthOpen(false);
      setStage('goal');
    } catch {
      // Supabase returns one opaque error for BOTH "no such user" and "wrong
      // password" (anti-enumeration), so a failed sign-in alone can't tell us
      // which it was. Sign-up disambiguates: if it says the account exists,
      // the account is real and the password was simply wrong — say that,
      // instead of parroting "User already registered" (B-15).
      try {
        await auth.signUp(email, password);
        setAuthOpen(false);
        setStage('goal');
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        setAuthError(
          /already\s*(been\s*)?registered|already exists|user_already_exists/i.test(msg)
            ? 'Wrong password for this email. Try again, or use a different email.'
            : msg || 'Could not sign in',
        );
      }
    } finally { setAuthBusy(false); }
  };

  // B-13: Trends/Report had no handler at all — tapping did nothing, which
  // reads as a broken app. They now answer honestly (and render dimmed).
  const onTab = (i: number) => {
    if (i === 0) { setStage('today'); return; }
    if (i === 3) { setStage('profile'); return; }
    alert(i === 1 ? str.trends : str.report, str.tabSoon);
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
      if (auth.session) await deleteAccount(supabaseUrl, supabaseAnonKey, auth);
      await store.clear();
      await water.clear();
      await kv.setItem(PROFILE_KEY, '');
      await auth.signOut();
      setPlan(null);
      setConfirmDelete(false);
      setStage('welcome');
    } catch (e) {
      alert('Delete failed', e instanceof Error ? e.message : 'Try again.');
    } finally { setDeleting(false); }
  };

  if (stage === 'boot') return <BootSplash theme={theme} wordmark={onb.appName} />;

  if (stage === 'welcome' || stage === 'goal' || stage === 'about' || stage === 'plan') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <FadeSlideIn key={stage}>
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
        </FadeSlideIn>
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
        <FadeSlideIn key="profile">
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
          onTab={onTab}
          onLog={() => { setStage('today'); setSheet('log'); }} />
        </FadeSlideIn>
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
      <FadeSlideIn key="today">
      <TodayScreen theme={theme} vm={vm}
        onLog={() => setSheet('log')}
        onScan={soon('Scan')} onDescribe={soon('Describe')}
        onTab={onTab}
        onProfile={() => setStage('profile')}
        onAddWater={() => void addWater()}
        onUndoWater={() => void undoWater()}
        onRetrySync={() => void runSync()} />
      </FadeSlideIn>
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
              <SearchScreen theme={theme} query={query} error={searchError} busy={searching}
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
