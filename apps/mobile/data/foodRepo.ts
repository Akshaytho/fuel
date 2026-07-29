/** Food search against OUR Supabase foods table (spec 0005). No data in code. */
export interface FoodHit {
  id: string;
  name: string;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
}

export interface FoodRepo {
  search(query: string, limit?: number): Promise<FoodHit[]>;
}

/** PostgREST-backed repo. url/key injected (EXPO_PUBLIC_* in the app). */
export function createSupabaseFoodRepo(url: string, anonKey: string): FoodRepo {
  return {
    async search(query, limit = 20) {
      const q = query.trim();
      if (q.length < 2) return [];
      // B-20: ranking happens IN THE DATABASE (migration 0005). Alphabetical
      // ordering put "Babyfood, apple-banana juice" above "Bananas, raw", and
      // client-side re-ranking can't fix that — at scale the right rows aren't
      // in the alphabetical first page at all.
      const res = await fetch(`${url}/rest/v1/rpc/search_foods`, {
        method: 'POST',
        headers: {
          apikey: anonKey, Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q, lim: limit }),
      });
      if (!res.ok) throw new Error(`food search failed: ${res.status}`);
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        kcal_per_100g: Number(r.kcal_per_100g),
        protein_g_per_100g: Number(r.protein_g_per_100g),
        carbs_g_per_100g: Number(r.carbs_g_per_100g),
        fat_g_per_100g: Number(r.fat_g_per_100g),
      }));
    },
  };
}
