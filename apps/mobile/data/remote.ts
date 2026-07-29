/** Supabase remote for LogStore sync + profile upsert (spec 0006/0007). */
import type { Remote, LocalEntry, WaterRemote, WaterEntry } from '@fuel/store';
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
