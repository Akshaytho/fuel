/** Supabase remote for LogStore sync + profile upsert (spec 0006/0007). */
import type { Remote, LocalEntry, WaterRemote, WaterEntry } from '@fuel/store';
import type { Targets, Profile } from '@fuel/domain';
import type { Session } from './auth';

export function createRemote(url: string, anonKey: string, getSession: () => Session | null): Remote {
  return {
    async push(e: LocalEntry) {
      const s = getSession();
      if (!s) throw new Error('no session');
      const res = await fetch(`${url}/rest/v1/log_entries?on_conflict=user_id,client_id`, {
        method: 'POST',
        headers: {
          apikey: anonKey, Authorization: `Bearer ${s.access_token}`,
          'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({
          client_id: e.client_id, user_id: s.user_id, day: e.day,
          food_id: e.food_id, food_name: e.food_name, grams: e.grams,
          kcal: e.kcal, protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g,
          source: e.source, meal: e.meal, logged_at: e.logged_at,
        }),
      });
      if (!res.ok) throw new Error(`push failed: ${res.status}`);
    },
  };
}

/** Water sync (B-16). Same ignore-duplicates idempotency as log entries. */
export function createWaterRemote(url: string, anonKey: string, getSession: () => Session | null): WaterRemote {
  return {
    async push(e: WaterEntry) {
      const s = getSession();
      if (!s) throw new Error('no session');
      const res = await fetch(`${url}/rest/v1/water_entries?on_conflict=user_id,client_id`, {
        method: 'POST',
        headers: {
          apikey: anonKey, Authorization: `Bearer ${s.access_token}`,
          'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({
          client_id: e.client_id, user_id: s.user_id, day: e.day,
          ml: e.ml, logged_at: e.logged_at,
        }),
      });
      if (!res.ok) throw new Error(`water push failed: ${res.status}`);
    },
  };
}

export async function upsertProfile(
  url: string, anonKey: string, s: Session,
  p: Profile, targets: Targets,
): Promise<void> {
  const res = await fetch(`${url}/rest/v1/profiles?id=eq.${s.user_id}`, {
    method: 'PATCH',
    headers: { apikey: anonKey, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sex: p.sex, age_years: p.age_years, height_cm: p.height_cm, weight_kg: p.weight_kg,
      activity: p.activity, goal: p.goal,
      target_kcal: targets.kcal, target_protein_g: targets.protein_g,
      target_carbs_g: targets.carbs_g, target_fat_g: targets.fat_g,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`profile upsert failed: ${res.status}`);
}
