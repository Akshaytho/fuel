/**
 * RC-4 (QA review): persisted local data evolves across app versions, but it
 * was read as `JSON.parse(raw) as LatestType` — so a blob written by an older
 * build (no `meal`, no `createdAt`) or a corrupted blob crashed newer code at
 * render (D-2), lied forever (D-7), or hung boot (D-13).
 *
 * This module is the single validated boundary between "bytes on disk" and
 * "typed data in memory". Every reader goes through it. Contract:
 *   - unknown/malformed input NEVER throws — worst case is [] / null,
 *   - missing newer fields get principled defaults,
 *   - garbage rows are dropped, not allowed to poison the rest.
 */
import type { LocalEntry } from './index';
import type { WaterEntry } from './water';
import type { WeighIn } from './weighins';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, dflt: string): string => (typeof v === 'string' && v.length > 0 ? v : dflt);
const num = (v: unknown, dflt: number): number => (isNum(v) ? v : dflt);

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const SOURCES = ['scan', 'describe', 'search', 'manual'] as const;

/** Pre-B-12 entries have no meal. Infer from the logged hour, like mealForHour. */
function mealFromLoggedAt(logged_at: unknown): LocalEntry['meal'] {
  const d = typeof logged_at === 'string' ? new Date(logged_at) : null;
  const h = d && !Number.isNaN(d.getTime()) ? d.getHours() : 12;
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}

function parseArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return []; // corrupted blob → empty store, app still boots (D-13)
  }
}

export function normalizeLogEntries(raw: string | null): LocalEntry[] {
  const out: LocalEntry[] = [];
  for (const r of parseArray(raw)) {
    if (typeof r !== 'object' || r === null) continue;
    const e = r as Record<string, unknown>;
    if (!isDay(e.day) || typeof e.client_id !== 'string' || e.client_id.length === 0) continue;
    out.push({
      client_id: e.client_id,
      day: e.day,
      food_id: typeof e.food_id === 'string' ? e.food_id : null,
      food_name: str(e.food_name, 'Food'),
      grams: num(e.grams, 0),
      kcal: num(e.kcal, 0),
      protein_g: num(e.protein_g, 0),
      carbs_g: num(e.carbs_g, 0),
      fat_g: num(e.fat_g, 0),
      source: (SOURCES as readonly string[]).includes(e.source as string)
        ? (e.source as LocalEntry['source']) : 'manual',
      // D-2: the field pre-B-12 builds never wrote — inferred, never undefined
      meal: (MEALS as readonly string[]).includes(e.meal as string)
        ? (e.meal as LocalEntry['meal']) : mealFromLoggedAt(e.logged_at),
      logged_at: str(e.logged_at, `${e.day}T12:00:00.000Z`),
      synced: e.synced === true,
    });
  }
  return out;
}

export function normalizeWaterEntries(raw: string | null): WaterEntry[] {
  const out: WaterEntry[] = [];
  for (const r of parseArray(raw)) {
    if (typeof r !== 'object' || r === null) continue;
    const e = r as Record<string, unknown>;
    if (!isDay(e.day) || typeof e.client_id !== 'string' || !isNum(e.ml) || e.ml <= 0) continue;
    out.push({
      client_id: e.client_id, day: e.day, ml: e.ml,
      logged_at: str(e.logged_at, `${e.day}T12:00:00.000Z`),
      synced: e.synced === true,
    });
  }
  return out;
}

export function normalizeWeighIns(raw: string | null): WeighIn[] {
  const out: WeighIn[] = [];
  const seen = new Set<string>();
  for (const r of parseArray(raw)) {
    if (typeof r !== 'object' || r === null) continue;
    const e = r as Record<string, unknown>;
    if (!isDay(e.day) || !isNum(e.kg) || e.kg < 25 || e.kg > 400) continue;
    if (seen.has(e.day)) continue;               // one measurement per day, always
    seen.add(e.day);
    out.push({
      day: e.day, kg: e.kg,
      logged_at: str(e.logged_at, `${e.day}T07:00:00.000Z`),
      synced: e.synced === true,
    });
  }
  return out;
}

export interface StoredPlanShape {
  profile: {
    sex: 'male' | 'female'; age_years: number; height_cm: number; weight_kg: number;
    activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
    goal: 'lose' | 'maintain' | 'gain';
  };
  targets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; clamped: boolean };
  water_l: number;
  reminder: boolean;
  createdAt: string;
}

/**
 * Validated StoredPlan reader. Returns null (→ onboarding) rather than ever
 * crashing boot. D-7: a plan written before `createdAt` existed gets its
 * start date backfilled from the OLDEST entry day — the earliest evidence of
 * this user's life in the app — instead of a permanent "Day 1".
 */
export function normalizeStoredPlan(raw: string | null, oldestEntryDay?: string): StoredPlanShape | null {
  if (!raw || raw.length <= 2) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (typeof v !== 'object' || v === null) return null;
  const p = v as Record<string, unknown>;
  const prof = p.profile as Record<string, unknown> | undefined;
  const targ = p.targets as Record<string, unknown> | undefined;
  if (!prof || !targ) return null;
  if (!isNum(prof.age_years) || !isNum(prof.height_cm) || !isNum(prof.weight_kg)) return null;
  if (!isNum(targ.kcal) || !isNum(targ.protein_g)) return null;
  const fallbackCreated = oldestEntryDay && DAY_RE.test(oldestEntryDay)
    ? `${oldestEntryDay}T00:00:00.000Z`
    : new Date().toISOString();
  return {
    profile: {
      sex: prof.sex === 'male' ? 'male' : 'female',
      age_years: prof.age_years, height_cm: prof.height_cm, weight_kg: prof.weight_kg,
      activity: (['sedentary', 'light', 'moderate', 'active', 'very_active'] as const)
        .includes(prof.activity as never) ? (prof.activity as StoredPlanShape['profile']['activity']) : 'light',
      goal: (['lose', 'maintain', 'gain'] as const).includes(prof.goal as never)
        ? (prof.goal as StoredPlanShape['profile']['goal']) : 'maintain',
    },
    targets: {
      kcal: targ.kcal, protein_g: targ.protein_g,
      carbs_g: num(targ.carbs_g, 0), fat_g: num(targ.fat_g, 0),
      clamped: targ.clamped === true,
    },
    water_l: num(p.water_l, 2),
    reminder: p.reminder !== false,
    createdAt: str(p.createdAt, fallbackCreated),
  };
}
