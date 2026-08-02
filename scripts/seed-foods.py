#!/usr/bin/env python3
"""P1-06 — seed public.foods from USDA FoodData Central (Foundation + SR Legacy).

Fetches from the USDA API and writes DIRECTLY into Supabase via the
Management API. No food data ever touches the repo (CLAUDE.md rule).
Idempotent: ON CONFLICT (source, source_ref) DO NOTHING.

Usage: python3 scripts/seed-foods.py [--limit-pages N]
Reads .env: USDA_API_KEY, SUPABASE_ACCESS_TOKEN. Project ref hardcoded ok
(it is an identifier, not data).
"""
import json, sys, time, urllib.request, urllib.error

ENV = dict(l.strip().split('=', 1) for l in open('.env')
           if '=' in l and not l.strip().startswith('#'))
# .env may hold a stale/invalid key (P1-06 blocker). Allow an override so a
# fibre backfill of the already-seeded rows can run on DEMO_KEY without
# waiting for a valid production key.
import os
USDA_KEY = (os.environ.get('USDA_API_KEY_OVERRIDE') or ENV['USDA_API_KEY']).strip()
SB_TOKEN = ENV['SUPABASE_ACCESS_TOKEN']
REF = 'wccxzcrxdcqvprswdvlu'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0'

# USDA nutrient numbers (per 100 g in Foundation/SR Legacy)
N_KCAL, N_PROTEIN, N_FAT, N_CARBS = '208', '203', '204', '205'
# Spec 0015: fibre is NULLABLE all the way down. A food that does not report
# it gets NULL, never 0 — "we don't know" and "there is none" are different
# facts and the app shows them differently.
N_FIBER = '291'

def http(url, payload=None, timeout=90, bearer=None):
    headers = {'User-Agent': UA, 'Content-Type': 'application/json'}
    if bearer:
        headers['Authorization'] = f'Bearer {bearer}'
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers=headers,
        method='POST' if payload is not None else 'GET')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read() or b'null')
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:200]
            if e.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(5 * (attempt + 1)); continue
            raise RuntimeError(f'HTTP {e.code}: {body}')
    raise RuntimeError('unreachable')

def sql(query):
    return http(f'https://api.supabase.com/v1/projects/{REF}/database/query',
                {'query': query}, bearer=SB_TOKEN)

def esc(s):
    return s.replace("'", "''")

def fetch_page(page, page_size=200):
    url = ('https://api.nal.usda.gov/fdc/v1/foods/list'
           f'?api_key={USDA_KEY}&dataType=Foundation,SR%20Legacy'
           f'&pageSize={page_size}&pageNumber={page}')
    return http(url)

def to_row(food):
    nutrients = {n.get('number') or n.get('nutrientNumber'):
                 n.get('amount') for n in food.get('foodNutrients', [])}
    kcal = nutrients.get(N_KCAL)
    p = nutrients.get(N_PROTEIN) or 0
    c = nutrients.get(N_CARBS) or 0
    f = nutrients.get(N_FAT) or 0
    fib = nutrients.get(N_FIBER)          # may legitimately be absent → NULL
    if kcal is None:
        kcal = 4 * p + 4 * c + 9 * f          # Atwater fallback
    if kcal is None or kcal < 0:
        return None
    name = (food.get('description') or '').strip()
    if not name:
        return None
    fib_sql = 'null' if fib is None else str(round(fib, 1))
    return (f"('usda','{food['fdcId']}','{esc(name[:200])}',"
            f"{round(kcal,1)},{round(p,1)},{round(c,1)},{round(f,1)},{fib_sql},true)")

def main():
    limit_pages = None
    if '--limit-pages' in sys.argv:
        limit_pages = int(sys.argv[sys.argv.index('--limit-pages') + 1])
    total = 0
    page = 1
    while True:
        if limit_pages and page > limit_pages:
            break
        foods = fetch_page(page)
        if not foods:
            break
        rows = [r for r in (to_row(f) for f in foods) if r]
        if rows:
            q = ('insert into public.foods '
                 '(source, source_ref, name, kcal_per_100g, protein_g_per_100g,'
                 ' carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, verified) values '
                 + ',\n'.join(rows)
                 # Spec 0015: re-running the seed BACKFILLS fibre onto rows that
                 # predate the column, instead of skipping them entirely.
                 + ' on conflict (source, source_ref) where source_ref is not null'
                   ' do update set fiber_g_per_100g = excluded.fiber_g_per_100g'
                   ' where public.foods.fiber_g_per_100g is null')
            sql(q)
            total += len(rows)
        print(f'page {page}: {len(rows)} rows (total {total})', flush=True)
        page += 1
        time.sleep(0.6)   # stay well under USDA rate limits
    count = sql("select count(*)::int as n, "
                "count(*) filter (where source='usda')::int as usda "
                "from public.foods")
    print('DB says:', count)

if __name__ == '__main__':
    main()
