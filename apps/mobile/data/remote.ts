/** Supabase remote for LogStore sync + profile upsert (spec 0006/0007). */
import type { Remote, LocalEntry, WaterRemote, WaterEntry, WeighInRemote, WeighIn } from '@fuel/store';
import type { Targets, Profile } from '@fuel/domain';
import type { Session } from './auth';
import { authedFetch, restHeaders, type AuthContext } from './authedFetch';

/** B-14: every authenticated call now refreshes once on 401 instead of
    failing forever with an access token that expired an hour into the session. */
export function createRemote(url: string, anonKey: string, ctx: AuthContext): Remote {
  return {
    async push(e: LocalEntry) {
      const res = await authedFetch(ctx, `${url}/rest/v1/log_entries?on_conflict=user_id,client_id`, (s) => ({
        method: 'POST',
        headers: restHeaders(anonKey, s, { Prefer: 'resolution=ignore-duplicates' }),
        body: JSON.stringify({
          client_id: e.client_id, user_id: s.user_id, day: e.day,
          food_id: e.food_id, food_name: e.food_name, grams: e.grams,
          kcal: e.kcal, protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g,
          // spec 0015: send null explicitly so the server stores "unknown",
          // not a default. Postgres column is nullable for exactly this.
          fiber_g: e.fiber_g ?? null,
          source: e.source, meal: e.meal, logged_at: e.logged_at,
        }),
      }));
      if (!res.ok) throw new Error(`push failed: ${res.status}`);
    },
  };
}

/** Water sync (B-16). Same ignore-duplicates idempotency as log entries. */
export function createWaterRemote(url: string, anonKey: string, ctx: AuthContext): WaterRemote {
  return {
    async push(e: WaterEntry) {
      const res = await authedFetch(ctx, `${url}/rest/v1/water_entries?on_conflict=user_id,client_id`, (s) => ({
        method: 'POST',
        headers: restHeaders(anonKey, s, { Prefer: 'resolution=ignore-duplicates' }),
        body: JSON.stringify({
          client_id: e.client_id, user_id: s.user_id, day: e.day,
          ml: e.ml, logged_at: e.logged_at,
        }),
      }));
      if (!res.ok) throw new Error(`water push failed: ${res.status}`);
    },
  };
}

/** Mislogged food: deleting a SYNCED entry must delete it on the server too. */
export async function deleteLogEntry(url: string, anonKey: string, ctx: AuthContext, clientId: string): Promise<void> {
  const res = await authedFetch(ctx, `${url}/rest/v1/log_entries?client_id=eq.${encodeURIComponent(clientId)}`, (s) => ({
    method: 'DELETE',
    headers: restHeaders(anonKey, s),
  }));
  if (!res.ok) throw new Error(`entry delete failed: ${res.status}`);
}

/** RC-5 (D-11): undoing a SYNCED glass must delete it on the server too. */
export async function deleteWaterEntry(url: string, anonKey: string, ctx: AuthContext, clientId: string): Promise<void> {
  const res = await authedFetch(ctx, `${url}/rest/v1/water_entries?client_id=eq.${encodeURIComponent(clientId)}`, (s) => ({
    method: 'DELETE',
    headers: restHeaders(anonKey, s),
  }));
  if (!res.ok) throw new Error(`water delete failed: ${res.status}`);
}

/** Weigh-in sync (spec 0009). Server PK (user_id, day) → merge-duplicates
    makes a same-day correction a clean UPSERT, replayable safely. */
export function createWeighInRemote(url: string, anonKey: string, ctx: AuthContext): WeighInRemote {
  return {
    async push(e: WeighIn) {
      const res = await authedFetch(ctx, `${url}/rest/v1/weigh_ins?on_conflict=user_id,day`, (s) => ({
        method: 'POST',
        headers: restHeaders(anonKey, s, { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify({ user_id: s.user_id, day: e.day, weight_kg: e.kg }),
      }));
      if (!res.ok) throw new Error(`weigh-in push failed: ${res.status}`);
    },
  };
}

export async function upsertProfile(
  url: string, anonKey: string, ctx: AuthContext,
  p: Profile, targets: Targets,
): Promise<void> {
  const id = ctx.session?.user_id ?? '';
  const res = await authedFetch(ctx, `${url}/rest/v1/profiles?id=eq.${id}`, (s) => ({
    method: 'PATCH',
    headers: restHeaders(anonKey, s),
    body: JSON.stringify({
      sex: p.sex, age_years: p.age_years, height_cm: p.height_cm, weight_kg: p.weight_kg,
      activity: p.activity, goal: p.goal,
      target_kcal: targets.kcal, target_protein_g: targets.protein_g,
      target_carbs_g: targets.carbs_g, target_fat_g: targets.fat_g,
      updated_at: new Date().toISOString(),
    }),
  }));
  if (!res.ok) throw new Error(`profile upsert failed: ${res.status}`);
}

/** GDPR erasure via edge function — also refreshes on 401 (B-14). */
export async function deleteAccount(url: string, anonKey: string, ctx: AuthContext): Promise<void> {
  const res = await authedFetch(ctx, `${url}/functions/v1/delete-account`, (s: Session) => ({
    method: 'POST',
    headers: { Authorization: `Bearer ${s.access_token}`, apikey: anonKey },
  }));
  if (!res.ok) throw new Error(`server delete failed: ${res.status}`);
}

/* ---------- RC-1 (D-6): server reads for sign-in restore ---------- */

async function getRows(url: string, anonKey: string, ctx: AuthContext, path: string): Promise<Array<Record<string, unknown>>> {
  const res = await authedFetch(ctx, `${url}/rest/v1/${path}`, (s) => ({
    method: 'GET', headers: restHeaders(anonKey, s),
  }));
  if (!res.ok) throw new Error(`fetch ${path.split('?')[0]} failed: ${res.status}`);
  return (await res.json()) as Array<Record<string, unknown>>;
}

export interface ServerProfileRow {
  sex: 'male' | 'female' | null; age_years: number | null; height_cm: number | null;
  weight_kg: number | null; activity: string | null; goal: string | null;
  target_kcal: number | null; target_protein_g: number | null;
  target_carbs_g: number | null; target_fat_g: number | null; created_at: string;
}

export async function fetchProfile(url: string, anonKey: string, ctx: AuthContext): Promise<ServerProfileRow | null> {
  const rows = await getRows(url, anonKey, ctx, `profiles?select=*&id=eq.${ctx.session?.user_id ?? ''}`);
  return (rows[0] as unknown as ServerProfileRow) ?? null;
}

export async function fetchLogEntries(url: string, anonKey: string, ctx: AuthContext): Promise<LocalEntry[]> {
  const rows = await getRows(url, anonKey, ctx, 'log_entries?select=*&order=logged_at.asc');
  return rows.map((r) => ({
    client_id: String(r.client_id), day: String(r.day),
    food_id: r.food_id ? String(r.food_id) : null, food_name: String(r.food_name ?? 'Food'),
    grams: Number(r.grams ?? 0), kcal: Number(r.kcal ?? 0),
    protein_g: Number(r.protein_g ?? 0), carbs_g: Number(r.carbs_g ?? 0), fat_g: Number(r.fat_g ?? 0),
    fiber_g: r.fiber_g === null || r.fiber_g === undefined ? null : Number(r.fiber_g),
    source: (['scan','describe','search','manual'] as const).includes(r.source as never) ? (r.source as LocalEntry['source']) : 'manual',
    meal: (['breakfast','lunch','dinner','snack'] as const).includes(r.meal as never) ? (r.meal as LocalEntry['meal']) : 'snack',
    logged_at: String(r.logged_at ?? ''), synced: true,
  }));
}

export async function fetchWaterEntries(url: string, anonKey: string, ctx: AuthContext): Promise<WaterEntry[]> {
  const rows = await getRows(url, anonKey, ctx, 'water_entries?select=*&order=logged_at.asc');
  return rows.map((r) => ({
    client_id: String(r.client_id), day: String(r.day), ml: Number(r.ml ?? 0),
    logged_at: String(r.logged_at ?? ''), synced: true,
  }));
}

export async function fetchWeighIns(url: string, anonKey: string, ctx: AuthContext): Promise<WeighIn[]> {
  const rows = await getRows(url, anonKey, ctx, 'weigh_ins?select=*&order=day.asc');
  return rows.map((r) => ({
    day: String(r.day), kg: Number(r.weight_kg ?? 0),
    logged_at: String(r.created_at ?? ''), synced: true,
  }));
}
