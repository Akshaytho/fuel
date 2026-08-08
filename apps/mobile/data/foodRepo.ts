/** Food search + custom foods against OUR Supabase foods table (specs 0005, 0018). No data in code. */
import { authedFetch, restHeaders, type AuthContext } from './authedFetch';

export interface FoodHit {
  id: string;
  name: string;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  /** spec 0015: NULL when the source reported no figure. Never coerce to 0. */
  fiber_g_per_100g: number | null;
}

/** What the create-food sheet sends (spec 0018). Per 100 g, fibre nullable. */
export interface NewCustomFood {
  name: string;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number | null;
}

export interface FoodRepo {
  search(query: string, limit?: number): Promise<FoodHit[]>;
  /** Insert a user-owned food; RLS ties it to the signed-in user. */
  create(input: NewCustomFood): Promise<FoodHit>;
}

function toHit(r: Record<string, unknown>): FoodHit {
  return {
    id: String(r.id),
    name: String(r.name),
    kcal_per_100g: Number(r.kcal_per_100g),
    protein_g_per_100g: Number(r.protein_g_per_100g),
    carbs_g_per_100g: Number(r.carbs_g_per_100g),
    fat_g_per_100g: Number(r.fat_g_per_100g),
    // A missing fibre figure stays missing all the way to the screen.
    fiber_g_per_100g: r.fiber_g_per_100g === null || r.fiber_g_per_100g === undefined
      ? null : Number(r.fiber_g_per_100g),
  };
}

/** PostgREST-backed repo. url/key injected (EXPO_PUBLIC_* in the app).
    `auth` makes search see the user's OWN foods too (RLS, spec 0018);
    without a session it falls back to the anon catalog-only view. */
export function createSupabaseFoodRepo(url: string, anonKey: string, auth?: AuthContext): FoodRepo {
  const anonHeaders = {
    apikey: anonKey, Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };
  return {
    async search(query, limit = 20) {
      const q = query.trim();
      if (q.length < 2) return [];
      // B-20: ranking happens IN THE DATABASE (migration 0005/0008). The
      // user's own foods require their JWT to pass RLS — the anon key only
      // sees the catalog, which is exactly right when signed out.
      const rpcUrl = `${url}/rest/v1/rpc/search_foods`;
      const body = JSON.stringify({ q, lim: limit });
      let res: Response;
      try {
        if (!auth) throw new Error('no session');
        res = await authedFetch(auth, rpcUrl, (s) => ({
          method: 'POST', headers: restHeaders(anonKey, s), body,
        }));
      } catch {
        res = await fetch(rpcUrl, { method: 'POST', headers: anonHeaders, body });
      }
      if (!res.ok) throw new Error(`food search failed: ${res.status}`);
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      return rows.map(toHit);
    },

    async create(input) {
      if (!auth) throw new Error('no session');
      // owner_id comes from the session; the insert policy re-checks it
      // (with check owner_id = auth.uid()), so a stale id cannot mislabel a row.
      const res = await authedFetch(auth, `${url}/rest/v1/foods`, (s) => ({
        method: 'POST',
        headers: restHeaders(anonKey, s, { Prefer: 'return=representation' }),
        body: JSON.stringify({
          source: 'user',
          owner_id: s.user_id,
          name: input.name.trim(),
          kcal_per_100g: input.kcal_per_100g,
          protein_g_per_100g: input.protein_g_per_100g,
          carbs_g_per_100g: input.carbs_g_per_100g,
          fat_g_per_100g: input.fat_g_per_100g,
          fiber_g_per_100g: input.fiber_g_per_100g,   // null stays null (spec 0015)
        }),
      }));
      if (!res.ok) throw new Error(`create food failed: ${res.status}`);
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      const row = rows[0];
      if (!row) throw new Error('create food returned no row');
      return toHit(row);
    },
  };
}
