import React, { useEffect, useMemo, useState } from 'react';
import { View, Modal, Pressable, TextInput } from 'react-native';
import { Theme } from '@fuel/tokens';
import {
  scalePer100g, summarizeConsumed, computeTargets, waterLitersFor, mealForHour, localDayISO,
  summarizeFiber, scaleFiber,
  computeStreak, dayNumber,
  smoothWeights, weeklySlopeKgPerWeek, dailyTotals, proteinDaysByWeek, loggedPercent, daysBetween,
  weeklyReport, lastCompleteWeek, addDays, goTosForMeal, yesterdaysItems, foodKey, repeatMealsFor, usualDayFor,
  weekAtAGlance, dayNote, comebackNote, celebrationFor,
  type Targets, type Meal, type Profile, type Celebration,
} from '@fuel/domain';
import { LogStore, WaterStore, WeighInStore, GLASS_ML, normalizeStoredPlan, type StorageAdapter, type WaterStorageAdapter, type WeighInStorageAdapter } from '@fuel/store';
import { createAuth, type KV, type Auth } from '../data/auth';
import {
  createRemote, createWaterRemote, createWeighInRemote, upsertProfile, deleteAccount,
  deleteWaterEntry, deleteLogEntry, fetchProfile, fetchLogEntries, fetchWaterEntries, fetchWeighIns,
} from '../data/remote';
import { createSupabaseFoodRepo, type FoodHit, type NewCustomFood } from '../data/foodRepo';
import { TodayScreen, type TodayVM } from './TodayScreen';
import { TrendsScreen, type TrendsVM } from './TrendsScreen';
import { type ReportVM } from './ReportScreen';
import { rp } from './reportStrings';
import { tr } from './trendsStrings';
import { LogSheet, SearchScreen, PortionSheet, CreateFoodSheet } from './logflow';
import { logStr } from './logStrings';
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
  weighInAdapter: WeighInStorageAdapter;
  supabaseUrl: string;
  supabaseAnonKey: string;
  alert: (title: string, message: string) => void;
  /** deliver export text to the user (device: share sheet; harness: capture) */
  share: (filename: string, text: string) => void;
}

interface StoredPlan { profile: Profile; targets: Targets; water_l: number; reminder: boolean; createdAt?: string }
const PROFILE_KEY = 'fuel.profile.v1';
/** RC-5 (D-10): '1' while the server profile row is behind local truth. */
const PROFILE_DIRTY_KEY = 'fuel.profile.dirty.v1';
/** Design 6a: the celebration shows ONCE per day. This remembers which day. */
const CELEBRATED_KEY = 'fuel.celebrated.v1';
/** Spec 0012: days the user vouched for despite looking half-logged. */
const CONFIRMED_DAYS_KEY = 'fuel.confirmedDays.v1';

type Stage = 'boot' | 'welcome' | 'goal' | 'about' | 'plan' | 'today' | 'trends' | 'profile';

export function AppRoot({ theme, kv, entryAdapter, waterAdapter, weighInAdapter, supabaseUrl, supabaseAnonKey, alert, share }: AppRootProps) {
  const auth: Auth = useMemo(() => createAuth(supabaseUrl, supabaseAnonKey, kv), []);
  const store = useMemo(
    () => new LogStore(entryAdapter, createRemote(supabaseUrl, supabaseAnonKey, auth)),
    [],
  );
  const water = useMemo(
    () => new WaterStore(waterAdapter, createWaterRemote(supabaseUrl, supabaseAnonKey, auth)),
    [],
  );
  const weighIns = useMemo(
    () => new WeighInStore(weighInAdapter, createWeighInRemote(supabaseUrl, supabaseAnonKey, auth)),
    [],
  );
  // spec 0018: the session lets search see the user's OWN foods (RLS) and
  // lets them create new ones. Signed out, the repo falls back to the catalog.
  const repo = useMemo(() => createSupabaseFoodRepo(supabaseUrl, supabaseAnonKey, auth), []);

  const [stage, setStage] = useState<Stage>('boot');
  const [plan, setPlanState] = useState<StoredPlan | null>(null);
  const planRef = React.useRef<StoredPlan | null>(null);
  const setPlan = (p: StoredPlan | null) => { planRef.current = p; setPlanState(p); };
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
  const [sheet, setSheet] = useState<'none' | 'log' | 'search' | 'portion' | 'create'>('none');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState(false);
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
  const [weightOpen, setWeightOpen] = useState(false);
  const [entryToRemove, setEntryToRemove] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  /** local day already celebrated ('' = none). Loaded at boot, so killing and
      reopening the app does NOT replay the celebration. */
  const [celebratedDay, setCelebratedDay] = useState('');
  const [celebrationSeen, setCelebrationSeen] = useState(false);
  const [confirmedDays, setConfirmedDays] = useState<string[]>([]);

  const runSync = async () => {
    try {
      await store.sync();
      await water.sync();
      await weighIns.sync();
      // RC-5 (D-10): the profile upsert used to be fire-and-forget with a
      // swallowed catch — one offline onboarding meant the server NEVER
      // learned the user's targets. Now it retries on every sync until it
      // lands, exactly like entries do.
      if (await kv.getItem(PROFILE_DIRTY_KEY) === '1' && planRef.current) {
        await upsertProfile(supabaseUrl, supabaseAnonKey, auth, planRef.current.profile, planRef.current.targets);
        await kv.setItem(PROFILE_DIRTY_KEY, '');
      }
      setSyncFailed(store.pendingCount > 0 || water.pendingCount > 0 || weighIns.pendingCount > 0);
    } catch { setSyncFailed(true); }
    bump();
  };

  /** Design 6a: once dismissed (or auto-dismissed at 3 s) it does not return
   *  today — including after the app is killed and reopened. */
  const dismissCelebration = async () => {
    setCelebrationSeen(true);
    const day = todayISO();
    setCelebratedDay(day);
    try { await kv.setItem(CELEBRATED_KEY, day); } catch { /* best effort */ }
  };

  /** Spec 0012: the user overrules our half-logged heuristic for one day. */
  const confirmDay = async (day: string) => {
    const next = confirmedDays.includes(day) ? confirmedDays : [...confirmedDays, day];
    setConfirmedDays(next);
    try { await kv.setItem(CONFIRMED_DAYS_KEY, JSON.stringify(next)); } catch { /* best effort */ }
  };

  useEffect(() => {
    (async () => {
      const t0 = Date.now();
      await store.init();
      await water.init();
      await weighIns.init();
      await auth.init();                       // restore session if any
      // RC-4 (D-7/D-13): validated read — a legacy plan (no createdAt) gets
      // its start date backfilled from the OLDEST entry; corruption → null →
      // onboarding. Boot can no longer crash or hang on bad bytes.
      const oldest = store.allEntries().map((e) => e.day).sort()[0];
      setCelebratedDay((await kv.getItem(CELEBRATED_KEY)) ?? '');
      // Never let a bad string here break boot — worst case, we re-ask.
      try {
        const raw = JSON.parse((await kv.getItem(CONFIRMED_DAYS_KEY)) || '[]');
        if (Array.isArray(raw)) setConfirmedDays(raw.filter((d) => typeof d === 'string'));
      } catch { /* corrupt list is the same as no list */ }
      const parsed = normalizeStoredPlan(await kv.getItem(PROFILE_KEY), oldest);
      const returning = parsed !== null;
      if (parsed) setPlan(parsed);
      // Rule 0b: app open is a brand MOMENT — hold the splash long enough
      // for its spring to land, never a static flash (min 1400 ms).
      const hold = Math.max(0, 1400 - (Date.now() - t0));
      setTimeout(() => {
        setStage(returning ? 'today' : 'welcome');
        if (returning) void runSync();                       // background push
      }, hold);
    })().catch(() => setStage('welcome'));     // D-13: boot NEVER hangs on the splash
  }, []);

  // RC-2 (D-5): "what day is it" must be an INPUT to the screen, not a value
  // frozen by memoization. An app left open overnight showed yesterday's
  // rings/water/date until the first tap. A 30 s check bumps on rollover.
  const dayRef = React.useRef(localDayISO());
  useEffect(() => {
    const t = setInterval(() => {
      const now = localDayISO();
      if (now !== dayRef.current) { dayRef.current = now; bump(); }
    }, 30_000);
    return () => clearInterval(t);
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
    await kv.setItem(PROFILE_DIRTY_KEY, '1');
    setPlan(stored);
    setStage('today');
    void runSync();                            // durable: retried until it lands
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
    const pending = store.pendingCount + water.pendingCount + weighIns.pendingCount;

    // The week glance still feeds dayNote's perspective copy — it just no
    // longer RENDERS on Today. The 7-dot strip moved to Progress (IA 0001).
    const allEntries = store.allEntries();
    const glance = weekAtAGlance(
      allEntries.map((e) => ({ day: e.day, kcal: e.kcal })), day, targets.kcal,
      streak.restedDays);
    const note = dayNote({ summary, targets, week: glance });
    // spec 0015: fibre, and the coverage behind it. A number with no coverage
    // attached is the thing this feature exists to avoid.
    const fib = summarizeFiber(
      entries.map((e) => ({ kcal: e.kcal, fiber_g: e.fiber_g })), targets.kcal);
    // A covered gap is not a comeback — the run never broke. Showing
    // "Welcome back" AND "Your streak held" would be two apps talking at once.
    const restCovered = streak.restedDays.some((d) => {
      const back = daysBetween(d, day);
      return back >= 0 && back <= 1;
    });
    const comeback = entries.length === 0 && !restCovered
      ? comebackNote(allEntries.map((e) => e.day), day, streak)
      : null;
    // Once per day, and never again after it has been dismissed this session.
    const celebration: Celebration | null =
      celebratedDay === day || celebrationSeen
        ? null
        : celebrationFor({ summary, targets, streak, hourOfDay: new Date().getHours() });

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
      // IA 0001: ONE moment slot. Modelling it as a union rather than three
      // optional fields makes "never two banners" a type guarantee instead of
      // a habit. Priority is timeliness: a rest day that just saved the run,
      // then a comeback after a gap, then the everyday line under the rings
      // (whose tone is domain logic, and unit-tested).
      moment: restCovered
        ? { kind: 'note' as const, testID: 'rest-note',
            title: str.restSaved, body: str.restSavedSub(streak.restedDays.length) }
        : comeback !== null
          ? { kind: 'note' as const, testID: 'comeback-card',
              title: comeback.title, body: comeback.body }
          : note === null ? undefined : { kind: 'coach' as const, text: note.text, tone: note.tone },
      // spec 0015 lives in the DETAIL SHEET now, not on the surface — every
      // app in the field keeps micronutrients off the home screen.
      fibre: entries.length === 0 || fib.targetG === null ? undefined : {
        value: fib.allUnknown ? str.fibreUnknownValue(fib.targetG)
          : fib.complete ? str.fibreValue(fib.grams, fib.targetG)
          : str.fibreAtLeast(fib.grams, fib.targetG),
        caption: fib.allUnknown ? str.fibreUnknownAll
          : fib.unknownItems > 0 ? str.fibreGap(fib.unknownItems)
          : str.fibreFromPct(Math.round(fib.coverage * 100)),
        progress: fib.progress ?? undefined,
        unknown: fib.allUnknown,
      },
      celebration: celebration ?? undefined,
    };
  }, [stage, plan, tick, celebratedDay, celebrationSeen]);

  const EMPTY_TRENDS: TrendsVM = {
    week: { days: [], summary: '', floorHit: false },
    streak: { current: 0, suffix: '' },
    weight: { heroKg: null, deltaKg: null, deltaGood: true, sinceLabel: '', raw: [], trend: [], xLabels: [], slopeKgPerWeek: null },
    energy: { days: [], target: 0, xLabels: [], avgEaten: null },
    consistency: { weeks: [], lastWeekHits: 0, loggedPct: 0, anyLogs: false },
  };

  const trendsVM: TrendsVM = useMemo(() => {
    // Same guard as the Today vm: during boot the stores are not initialized
    // yet, and calling them throws (the journey caught exactly this crash).
    if (stage !== 'trends' || !plan) return EMPTY_TRENDS;
    const targets = plan.targets;
    const today = todayISO();
    const startDay = localDayISO(new Date(plan.createdAt ?? Date.now()));
    const entries = store.allEntries();
    const entryDays = entries.map((e) => e.day);
    const streakP = computeStreak(entryDays, today);

    // weight — WINDOWED to the last 90 days (rule 0c: a 2-year user has 730
    // weigh-ins; rendering them all is 1,460 SVG nodes and a flat unreadable
    // line. The design itself shows a window, and the slope/delta over the
    // window is the user's CURRENT story, not their ancient history).
    const WEIGHT_WINDOW_DAYS = 90;
    const allPoints = weighIns.all().map((e) => ({ day: e.day, kg: e.kg }))
      .sort((a, b) => daysBetween(b.day, a.day));
    // D-12: the window used to run BEFORE the existence check, so a user who
    // paused weighing for 3 months saw "log your first weight" over a year of
    // history. Anchor the window to their LAST weigh-in, not to today — the
    // chart always shows their most recent 90 days of real life.
    const anchor = allPoints.length > 0 ? allPoints[allPoints.length - 1]!.day : today;
    const points = allPoints.filter((p) => {
      const back = daysBetween(p.day, anchor);
      return Number.isFinite(back) && back >= 0 && back < WEIGHT_WINDOW_DAYS;
    });
    const smoothed = smoothWeights(points);
    const span = points.length > 1 ? daysBetween(points[0]!.day, points[points.length - 1]!.day) : 0;
    const frac = (d: string) => (span > 0 ? daysBetween(points[0]!.day, d) / span : 0.5);
    const first = smoothed[0];
    const last = smoothed[smoothed.length - 1];
    const deltaKg = first && last && points.length > 1
      ? Math.round((last.trendKg - first.trendKg) * 10) / 10 : null;
    const goal = plan.profile.goal;
    const deltaGood = deltaKg === null ? true
      : goal === 'lose' ? deltaKg <= 0 : goal === 'gain' ? deltaKg >= 0 : Math.abs(deltaKg) < 0.5;
    const monthDay = (d: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      if (!m) return d;
      return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    };

    // energy
    const days = dailyTotals(entries.map((e) => ({ day: e.day, value: e.kcal })), 14, today);
    const logged = days.filter((d) => d.value > 0);

    // consistency
    const dayProtein = dailyTotals(entries.map((e) => ({ day: e.day, value: e.protein_g })), 56, today);
    const weeks = proteinDaysByWeek(dayProtein, targets.protein_g, 8, today);

    const glanceP = weekAtAGlance(
      entries.map((e) => ({ day: e.day, kcal: e.kcal })), today, targets.kcal, streakP.restedDays);
    return {
      week: {
        days: glanceP.slots.map((sl) => ({ day: sl.day, letter: sl.letter, state: sl.state, onTarget: sl.onTarget })),
        summary: glanceP.summary,
        footnote: glanceP.avgKcal === null ? undefined : str.weekAvg(glanceP.avgKcal),
        floorHit: glanceP.weeklyFloorHit,
      },
      streak: {
        current: streakP.current,
        suffix: streakP.current === 1 ? str.day
          : streakP.restedDays.length > 0 ? str.daysWithRest(streakP.restedDays.length)
          : streakP.isLongest ? str.daysLongest : str.days,
      },
      weight: {
        heroKg: last ? last.trendKg : null,
        deltaKg,
        deltaGood,
        sinceLabel: first ? tr.since(monthDay(first.day)) : '',
        raw: points.map((p) => ({ x: frac(p.day), y: p.kg })),
        trend: smoothed.map((p) => ({ x: frac(p.day), y: p.trendKg })),
        xLabels: points.length > 1
          ? [monthDay(points[0]!.day), tr.today]
          : points.length === 1 ? [monthDay(points[0]!.day)] : [],
        slopeKgPerWeek: weeklySlopeKgPerWeek(points),
      },
      energy: {
        days: days.map((d) => d.value),
        target: targets.kcal,
        xLabels: [monthDay(days[0]!.day), monthDay(days[days.length - 1]!.day)],
        avgEaten: logged.length > 0
          ? logged.reduce((a, b) => a + b.value, 0) / logged.length : null,
      },
      consistency: {
        weeks: weeks.map((w) => w.hitDays),
        lastWeekHits: weeks[weeks.length - 1]?.hitDays ?? 0,
        loggedPct: loggedPercent(entryDays, startDay, today),
        anyLogs: entries.length > 0,
      },
    };
  }, [stage, plan, tick]);

  const reportVM: ReportVM = useMemo(() => {
    const empty: ReportVM = {
      report: {
        weekNumber: 1, weekStart: '', weekEnd: '', loggedDays: 0,
        loggedFlags: [false, false, false, false, false, false, false],
        dayClasses: ['none', 'none', 'none', 'none', 'none', 'none', 'none'],
        excludedDays: [],
        verdict: 'insufficient', deltaKg: null, missing: { loggedDays: 4, weighSpanDays: 5 },
        measuredTdee: null, formulaTdee: 0, blendedTdee: null, proposedTargets: null, weeklyGoalKg: 0,
      },
      rangeLabel: '', raw: [], trend: [],
    };
    // IA 0001: the report renders inside Progress's Week segment, so it must
    // be computed on the 'trends' stage too.
    if (stage !== 'trends' || !plan) return empty;
    const today = todayISO();
    const entries = store.allEntries();
    const report = weeklyReport({
      profile: plan.profile,
      currentTargets: plan.targets,
      startDay: localDayISO(new Date(plan.createdAt ?? Date.now())),
      today,
      dayKcal: dailyTotals(entries.map((e) => ({ day: e.day, value: e.kcal })), 21, today),
      weighIns: weighIns.all().map((w) => ({ day: w.day, kg: w.kg })),
      // spec 0012: days the user has vouched for, despite looking half-logged
      confirmedDays,
    });
    void confirmedDays;   // memo dependency, read above
    const md = (d: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      return m ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase() : d;
    };
    // chart: weigh-ins inside the report window
    const winStart = addDays(report.weekStart, -3);
    const pts = weighIns.all().map((w) => ({ day: w.day, kg: w.kg }))
      .filter((p) => daysBetween(winStart, p.day) >= 0 && daysBetween(p.day, addDays(report.weekEnd, 3)) >= 0)
      .sort((a, b) => daysBetween(b.day, a.day));
    const span = pts.length > 1 ? daysBetween(pts[0]!.day, pts[pts.length - 1]!.day) : 0;
    const frac = (d: string) => (span > 0 ? daysBetween(pts[0]!.day, d) / span : 0.5);
    const sm = smoothWeights(pts);
    return {
      report,
      rangeLabel: report.weekStart ? `${md(report.weekStart)}–${md(report.weekEnd)}` : '',
      raw: pts.map((p) => ({ x: frac(p.day), y: p.kg })),
      trend: sm.map((p) => ({ x: frac(p.day), y: p.trendKg })),
    };
  }, [stage, plan, tick, confirmedDays]);

  const acceptTargets = async () => {
    const proposed = reportVM.report.proposedTargets;
    if (!planRef.current || !proposed) return;
    const stored: StoredPlan = { ...planRef.current, targets: proposed };
    await kv.setItem(PROFILE_KEY, JSON.stringify(stored));
    await kv.setItem(PROFILE_DIRTY_KEY, '1');
    setPlan(stored);
    bump();
    alert(rp.accepted, rp.acceptedBody(proposed.kcal.toLocaleString('en-US')));
    await runSync();
  };

  const logIt = async (grams: number, meal: Meal) => {
    if (!picked) return;
    const per100 = {
      kcal: picked.kcal_per_100g, protein_g: picked.protein_g_per_100g,
      carbs_g: picked.carbs_g_per_100g, fat_g: picked.fat_g_per_100g,
    };
    // spec 0015: fibre scales alongside the macros but keeps its own
    // three-valued logic — a food with no figure yields null, not 0.
    const fiber_g = scaleFiber(picked.fiber_g_per_100g, grams);
    await store.add({
      day: todayISO(), food_id: picked.id, food_name: picked.name, grams,
      ...scalePer100g(per100, grams), fiber_g,
      source: 'search', meal, logged_at: new Date().toISOString(),
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
  const removeEntry = async (client_id: string) => {
    const removed = await store.remove(client_id);
    setEntryToRemove(null);
    if (!removed) return;
    bump();
    if (removed.synced) {
      try {
        await deleteLogEntry(supabaseUrl, supabaseAnonKey, auth, client_id);
      } catch {
        await store.restore(removed);          // local must not lie about the cloud
        bump();
        alert(str.removeFailedTitle, str.removeFailedBody);
      }
    }
  };

  const undoWater = async () => {
    const removed = await water.removeLast(todayISO());
    if (!removed) return;
    bump();
    if (removed.synced) {
      // D-11: it already reached the server — deleting only locally would
      // leave a ghost glass that a future restore resurrects.
      try {
        await deleteWaterEntry(supabaseUrl, supabaseAnonKey, auth, removed.client_id);
      } catch {
        await water.restore(removed);          // local must not lie about the cloud
        bump();
        alert(str.water, str.undoFailed);
      }
    }
  };

  /** spec 0011: the user's OWN most-logged foods for the current meal. */
  const currentMeal = (): Meal => mealForHour(new Date().getHours());
  const goToItems = useMemo(() => {
    if (!plan) return [];
    // E-06 (spec 0017): UTC hour on both sides, so the tz offset cancels —
    // your 7 am foods at 7 am, your 10 pm foods at 10 pm.
    return goTosForMeal(store.allEntries(), currentMeal(), todayISO(),
      undefined, undefined, new Date().getUTCHours());
  }, [plan, tick, sheet]);
  const yesterdayItems = useMemo(() => {
    if (!plan) return [];
    return yesterdaysItems(store.allEntries(), todayISO());
  }, [plan, tick, sheet]);
  /** spec 0014: the combinations this person actually repeats. Derived from
      the log, stored nowhere — nothing to name, maintain, sync or go stale. */
  const repeatMeals = useMemo(() => {
    if (!plan) return [];
    return repeatMealsFor(store.allEntries(), currentMeal(), todayISO());
  }, [plan, tick, sheet]);
  /** spec 0016: the whole usual day, composed from the same engines. */
  const usualDay = useMemo(() => {
    if (!plan) return null;
    return usualDayFor(store.allEntries(), todayISO());
  }, [plan, tick, sheet]);

  /** One tap = log it again exactly as last time (grams AND macros come from
      that most-recent entry, so it works offline and needs no re-fetch). */
  const quickAdd = async (key: string) => {
    const item = goToItems.find((g) => foodKey(g) === key);
    if (!item) return;
    await store.add({
      day: todayISO(), food_id: item.food_id, food_name: item.food_name,
      grams: item.grams, kcal: item.kcal, protein_g: item.protein_g,
      carbs_g: item.carbs_g, fat_g: item.fat_g, fiber_g: item.fiber_g ?? null,
      source: 'manual', meal: currentMeal(), logged_at: new Date().toISOString(),
    });
    setSheet('none');
    bump();
    alert(logStr.quickAddedTitle, logStr.quickAddedBody(item.food_name, Math.round(item.kcal)));
    await runSync();
  };

  /** One tap logs the whole plate, at the median portion of every time they
      ate it. Same write path as copy-yesterday, so it is offline-safe. */
  const logRepeat = async (id: string) => {
    const combo = repeatMeals.find((r) => r.id === id);
    if (!combo) return;
    for (const it of combo.items) {
      await store.add({
        day: todayISO(), food_id: it.food_id, food_name: it.food_name,
        grams: it.grams, kcal: it.kcal, protein_g: it.protein_g,
        carbs_g: it.carbs_g, fat_g: it.fat_g, fiber_g: it.fiber_g ?? null,
        source: 'manual', meal: currentMeal(), logged_at: new Date().toISOString(),
      });
    }
    setSheet('none');
    bump();
    alert(logStr.repeatLoggedTitle, logStr.repeatLoggedBody(combo.label, combo.items.length, combo.kcal));
    await runSync();
  };

  /** spec 0016: one tap writes the established usual for every unlogged
      slot — real foods, median portions, source 'easy' so the record keeps
      the truth that this was an asserted-typical day. */
  const logEasyDay = async () => {
    const d = usualDay;
    if (!d) return;
    for (const meal of d.meals) {
      for (const it of meal.items) {
        await store.add({
          day: todayISO(), food_id: it.food_id, food_name: it.food_name,
          grams: it.grams, kcal: it.kcal, protein_g: it.protein_g,
          carbs_g: it.carbs_g, fat_g: it.fat_g, fiber_g: it.fiber_g ?? null,
          source: 'easy', meal: meal.meal, logged_at: new Date().toISOString(),
        });
      }
    }
    setSheet('none');
    bump();
    alert(logStr.easyLoggedTitle, logStr.easyLoggedBody(d.label, d.kcal));
    await runSync();
  };

  const copyYesterday = async () => {
    const items = yesterdayItems;
    if (items.length === 0) return;
    for (const it of items) {
      await store.add({
        day: todayISO(), food_id: it.food_id, food_name: it.food_name,
        grams: it.grams, kcal: it.kcal, protein_g: it.protein_g,
        carbs_g: it.carbs_g, fat_g: it.fat_g, fiber_g: it.fiber_g ?? null,
        source: 'manual', meal: it.meal, logged_at: new Date().toISOString(),
      });
    }
    setSheet('none');
    bump();
    alert(logStr.copiedTitle, logStr.copiedBody(items.length));
    await runSync();
  };

  const emailAuth = async (email: string, password: string) => {
    setAuthBusy(true); setAuthError(undefined);
    try {
      await auth.signIn(email, password);
      setAuthOpen(false);
      await restoreFromServer();               // RC-1 (D-6): new phone ≠ new life
    } catch (signInErr) {
      // RC-6 (D-14): a NETWORK failure is not a credential failure. Without
      // this branch, a dropped request told users with the CORRECT password
      // "wrong password — use a different email", steering them into creating
      // a duplicate empty account.
      const m = signInErr instanceof Error ? signInErr.message : '';
      if (/network|fetch|timeout|abort/i.test(m)) {
        setAuthError('No connection — check your internet and try again.');
        setAuthBusy(false);
        return;
      }
      // Supabase returns one opaque error for BOTH "no such user" and "wrong
      // password" (anti-enumeration), so a failed sign-in alone can't tell us
      // which it was. Sign-up disambiguates: if it says the account exists,
      // the account is real and the password was simply wrong — say that,
      // instead of parroting "User already registered" (B-15).
      try {
        await auth.signUp(email, password);
        setAuthOpen(false);
        await restoreFromServer();             // existing-account-wrong-flow safety too
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

  // All four tabs are real destinations now (spec 0010 closed the last stub).
  // IA 0001: three destinations. Report merged into Progress, so index 2 is
  // now You — the old 'report' stage no longer exists.
  const onTab = (i: number) => {
    if (i === 0) { setStage('today'); return; }
    if (i === 1) { setStage('trends'); return; }
    setStage('profile');
  };

  const saveWeight = async () => {
    const kg = Number(weightInput);
    if (!Number.isFinite(kg) || kg < 25 || kg > 400) return; // sheet stays open; hint shows range
    await weighIns.set({ day: todayISO(), kg, logged_at: new Date().toISOString() });
    // RC-3 (D-4): the weigh-in IS the freshest truth about the user's body.
    // Targets/water goal were frozen at onboarding weight forever — a 90 kg
    // user who reached 75 kg kept 90 kg targets under a label promising
    // adaptation. Now every weigh-in recomputes the plan from current weight.
    if (planRef.current) {
      const profile: Profile = { ...planRef.current.profile, weight_kg: Math.round(kg * 10) / 10 };
      const targets = computeTargets(profile);
      const stored: StoredPlan = {
        ...planRef.current, profile, targets, water_l: waterLitersFor(profile.weight_kg),
      };
      await kv.setItem(PROFILE_KEY, JSON.stringify(stored));
      await kv.setItem(PROFILE_DIRTY_KEY, '1');
      setPlan(stored);
    }
    setWeightOpen(false); setWeightInput('');
    bump();
    await runSync();
  };

  /**
   * RC-1 (D-6): sync was write-only — a reinstall or new phone showed a
   * 300-day user an empty app and forced a fake Day 1. On sign-in we now
   * pull the server truth: profile+targets (skip onboarding entirely when
   * they exist) and full entry/water/weigh-in history, marked synced.
   */
  const restoreFromServer = async () => {
    try {
      const row = await fetchProfile(supabaseUrl, supabaseAnonKey, auth);
      const complete = row && row.sex && row.age_years && row.height_cm && row.weight_kg
        && row.activity && row.goal && row.target_kcal;
      if (!complete) { setStage('goal'); return; }         // genuinely new user
      const [entries, waterRows, weighRows] = await Promise.all([
        fetchLogEntries(supabaseUrl, supabaseAnonKey, auth),
        fetchWaterEntries(supabaseUrl, supabaseAnonKey, auth),
        fetchWeighIns(supabaseUrl, supabaseAnonKey, auth),
      ]);
      await store.replaceAll(entries);
      await water.replaceAll(waterRows);
      await weighIns.replaceAll(weighRows);
      const profile: Profile = {
        sex: row.sex!, age_years: row.age_years!, height_cm: row.height_cm!,
        weight_kg: row.weight_kg!,
        activity: row.activity as Profile['activity'], goal: row.goal as Profile['goal'],
      };
      const targets: Targets = {
        kcal: row.target_kcal!, protein_g: row.target_protein_g ?? 0,
        carbs_g: row.target_carbs_g ?? 0, fat_g: row.target_fat_g ?? 0, clamped: false,
      };
      const oldestDay = entries.map((e) => e.day).sort()[0];
      const stored: StoredPlan = {
        profile, targets, water_l: waterLitersFor(profile.weight_kg), reminder: true,
        createdAt: oldestDay ? `${oldestDay}T00:00:00.000Z` : row.created_at,
      };
      await kv.setItem(PROFILE_KEY, JSON.stringify(stored));
      setPlan(stored);
      setStage('today');                       // straight home, history intact
      bump();
    } catch {
      // server unreachable mid-restore: fall back to onboarding rather than
      // hang; their history hydrates on a later successful sign-in.
      setStage('goal');
    }
  };

  const comingSoon = () => alert(onb.comingSoonTitle, onb.comingSoonBody); // TODO(B-09): needs Harish's Apple/Google dev accounts
  const soon = (what: string) => () => alert(what, 'Arrives in Phase 2.'); // TODO(stub): P2

  const doExport = () => {
    if (!plan) return;
    const entries = store.allEntries();
    const csv = buildExportCSV(plan.profile, plan.targets, entries, water.allEntries(), weighIns.all());
    share(`fuel-export-${todayISO()}.csv`, csv);
    alert(pf.exportedTitle, pf.exportedBody(entries.length));
  };

  const doSignOut = async () => {
    // RC-1 (D-1): local data belongs to the account that made it. Sign-out
    // used to leave everything on disk — the next sign-in inherited the
    // previous user's meals AND pushed their pending rows into the new
    // account. Flush first; refuse to sign out if data would be lost.
    await runSync();
    const pending = store.pendingCount + water.pendingCount + weighIns.pendingCount;
    if (pending > 0) {
      alert(pf.signOutBlockedTitle, pf.signOutBlockedBody(pending));
      return;
    }
    await store.clear();
    await water.clear();
    await weighIns.clear();
    await kv.setItem(PROFILE_KEY, '');
    await kv.setItem(PROFILE_DIRTY_KEY, '');
    await auth.signOut();
    setPlan(null);
    setGoal(null);
    setAbout({ sex: 'female', age: '', height: '', weight: '', activity: null });
    setStage('welcome');
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      // RC-5 (D-3): server erasure is confirmed FIRST or the flow fails loudly.
      // The old `if (session)` guard silently skipped the server on a dead
      // session, wiped local evidence, and told the user everything was erased.
      await deleteAccount(supabaseUrl, supabaseAnonKey, auth); // throws if unconfirmed
      await store.clear();
      await water.clear();
      await weighIns.clear();
      await kv.setItem(PROFILE_KEY, '');
      await auth.signOut();
      setPlan(null);
      setConfirmDelete(false);
      setStage('welcome');
    } catch (e) {
      alert('Delete failed', e instanceof Error ? e.message : 'Try again.');
    } finally { setDeleting(false); }
  };

  // spec 0018: save a custom food, then flow straight into the portion sheet
  // for it — creating and logging are one motion, not two chores.
  const createFood = async (input: NewCustomFood) => {
    setCreateBusy(true); setCreateError(false);
    try {
      const hit = await repo.create(input);
      setPicked(hit);
      setQuery('');
      setSheet('portion');
    } catch {
      setCreateError(true);        // values stay in the sheet; nothing is lost
    } finally {
      setCreateBusy(false);
    }
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
            <GoalScreen theme={theme} value={goal} onSelect={setGoal} onContinue={() => setStage('about')}
            onCancel={plan ? () => setStage('profile') : undefined} />
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

  if (stage === 'trends' && plan) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <FadeSlideIn key="trends">
          <TrendsScreen theme={theme} vm={trendsVM} report={reportVM}
            onConfirmDay={(d: string) => { void confirmDay(d); }}
            onAcceptTargets={() => void acceptTargets()}
            onAdjustTargets={() => {
              const pr = planRef.current?.profile;
              if (pr) {
                setGoal(pr.goal);
                setAbout({ sex: pr.sex, age: String(pr.age_years), height: String(pr.height_cm), weight: String(pr.weight_kg), activity: pr.activity });
              }
              setStage('goal');
            }}
            onLogWeight={() => setWeightOpen(true)}
            onTab={onTab}
            onLog={() => { setStage('today'); setSheet('log'); }} />
        </FadeSlideIn>
        <Modal visible={weightOpen} transparent animationType="slide" onRequestClose={() => setWeightOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setWeightOpen(false)} />
          <Sheet theme={theme}>
            <View style={{ gap: 12 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: theme.label }}>{tr.weightSheetTitle}</Text>
              <TextInput
                testID="weight-kg-input"
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="70.5"
                placeholderTextColor={theme.secondaryLabel}
                keyboardType="decimal-pad"
                autoFocus
                style={{
                  backgroundColor: theme.bg, borderRadius: 12, padding: 14,
                  fontSize: 22, fontWeight: '700', color: theme.label,
                }}
              />
              <Text style={{ fontSize: 13, color: theme.secondaryLabel }}>{tr.weightSheetHint}</Text>
              <CTAButton theme={theme} testID="weight-save" label={tr.weightSave} onPress={() => void saveWeight()} />
            </View>
          </Sheet>
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
          onChangeGoal={() => {
            // D-8: prefill from stored truth — never blank fields the app
            // already knows, never a mistyped-weight path to wrong targets.
            const pr = planRef.current?.profile;
            if (pr) {
              setGoal(pr.goal);
              setAbout({
                sex: pr.sex, age: String(pr.age_years), height: String(pr.height_cm),
                weight: String(pr.weight_kg), activity: pr.activity,
              });
            }
            setStage('goal');
          }}
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
        onRetrySync={() => void runSync()}
        onRemoveEntry={(id) => setEntryToRemove(id)}
        onOpenProgress={() => setStage('trends')}
        onDismissCelebration={() => { void dismissCelebration(); }} />
      <Modal visible={entryToRemove !== null} transparent animationType="slide" onRequestClose={() => setEntryToRemove(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setEntryToRemove(null)} />
        <Sheet theme={theme}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.label }}>{str.removeTitle}</Text>
            <Text style={{ fontSize: 15, color: theme.secondaryLabel }}>
              {str.removeBody(store.allEntries().find((e) => e.client_id === entryToRemove)?.food_name ?? '')}
            </Text>
            <View style={{ backgroundColor: theme.danger, borderRadius: 16 }}>
              <CTAButton theme={theme} testID="confirm-remove-entry" label={str.removeCta}
                onPress={() => { if (entryToRemove) void removeEntry(entryToRemove); }} />
            </View>
            <Pressable testID="cancel-remove-entry" onPress={() => setEntryToRemove(null)} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: theme.tint }}>{pf.cancel}</Text>
            </Pressable>
          </View>
        </Sheet>
      </Modal>
      </FadeSlideIn>
      <Modal visible={sheet !== 'none'} transparent animationType="slide" onRequestClose={() => setSheet('none')}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setSheet('none')} />
        <View>
          {sheet === 'log' && (
            <LogSheet theme={theme} mealLabel={cap(mealForHour(new Date().getHours()))}
              goTos={goToItems.map((g) => ({
                id: foodKey(g),
                name: g.food_name,
                subtitle: `${Math.round(g.grams)} g · ${Math.round(g.kcal)} kcal`,
                often: g.count >= 3,
              }))}
              easyDay={usualDay === null ? null : {
                title: logStr.easyTitle(usualDay.label, usualDay.complete),
                subtitle: logStr.easySubtitle(usualDay.label, usualDay.kcal),
              }}
              onLogEasyDay={() => void logEasyDay()}
              repeats={repeatMeals.map((r) => ({
                id: r.id, label: r.label,
                subtitle: logStr.repeatSubtitle(r.items.length, r.kcal, r.days),
              }))}
              onLogRepeat={(id) => void logRepeat(id)}
              yesterdayCount={yesterdayItems.length}
              onSearchFocus={() => setSheet('search')}
              onScan={soon('Scan')} onDescribe={soon('Describe')} onLabel={soon('Label')}
              onSaved={soon('Saved')}
              onCopyYesterday={() => void copyYesterday()}
              onQuickAdd={(id) => void quickAdd(id)} />
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
                onCreate={() => { setCreateError(false); setSheet('create'); }}
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
          {sheet === 'create' && (
            <CreateFoodSheet theme={theme} initialName={query.trim()}
              busy={createBusy} error={createError}
              onSave={(i) => void createFood(i)} />
          )}
        </View>
      </Modal>
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
