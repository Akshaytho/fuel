#!/usr/bin/env python3
"""AC1 (spec 0005): prove live food search works against Supabase."""
import json, urllib.request, urllib.parse, sys
ENV = dict(l.strip().split('=',1) for l in open('.env') if '=' in l and not l.strip().startswith('#'))
url, key = ENV['SUPABASE_URL'], ENV['SUPABASE_ANON_KEY'].strip()
def search(q):
    p = urllib.parse.urlencode({'select':'name,kcal_per_100g,protein_g_per_100g','name':f'ilike.*{q}*','limit':'5'})
    req = urllib.request.Request(f'{url}/rest/v1/foods?{p}', headers={'apikey':key,'Authorization':f'Bearer {key}','User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())
ok = True
for q in ['butter','cheese','rice']:
    rows = search(q)
    print(f'"{q}": {len(rows)} hits — first: {rows[0]["name"] if rows else "NONE"}')
    ok = ok and len(rows) > 0
rows = search('zzzznotafood')
print(f'zero-result case: {len(rows)} hits (expected 0)')
ok = ok and len(rows) == 0
sys.exit(0 if ok else 1)
