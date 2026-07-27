#!/usr/bin/env python3
"""AC2 (spec 0006): LIVE proof of idempotent sync + RLS isolation.

Creates two e2e users (server-side), signs in, replays the same entry
twice (same client_id) → exactly ONE row; verifies user B cannot see
user A's entries; cleans up rows. Users persist for future runs.
"""
import json, urllib.request, urllib.error, uuid, sys, datetime

ENV = dict(l.strip().split('=', 1) for l in open('.env')
           if '=' in l and not l.strip().startswith('#'))
URL = ENV['SUPABASE_URL']; ANON = ENV['SUPABASE_ANON_KEY'].strip(); SVC = ENV['SUPABASE_SERVICE_KEY'].strip()
UA = 'Mozilla/5.0 (Macintosh) Chrome/126.0'

def req(url, method='GET', payload=None, headers=None, ok_codes=()):
    h = {'User-Agent': UA, 'Content-Type': 'application/json', **(headers or {})}
    r = urllib.request.Request(url, method=method,
        data=json.dumps(payload).encode() if payload is not None else None, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            body = resp.read()
            return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if e.code in ok_codes:
            return e.code, json.loads(body) if body else None
        raise RuntimeError(f'{method} {url.split("?")[0]} -> {e.code}: {body[:300]}')

def ensure_user(email, password):
    status, body = req(f'{URL}/auth/v1/admin/users', 'POST',
        {'email': email, 'password': password, 'email_confirm': True},
        {'apikey': SVC, 'Authorization': f'Bearer {SVC}'}, ok_codes=(422,))
    return body

def sign_in(email, password):
    _, body = req(f'{URL}/auth/v1/token?grant_type=password', 'POST',
        {'email': email, 'password': password}, {'apikey': ANON})
    return body['access_token'], body['user']['id']

def user_headers(jwt):
    return {'apikey': ANON, 'Authorization': f'Bearer {jwt}'}

PW = 'e2e-Fuel-2026!x'
ensure_user('e2e-a@fuel.test', PW)
ensure_user('e2e-b@fuel.test', PW)
jwt_a, uid_a = sign_in('e2e-a@fuel.test', PW)
jwt_b, uid_b = sign_in('e2e-b@fuel.test', PW)
print(f'users ready: A={uid_a[:8]}… B={uid_b[:8]}…')

client_id = str(uuid.uuid4())
today = datetime.date.today().isoformat()
entry = {
    'client_id': client_id, 'user_id': uid_a, 'day': today,
    'food_name': 'E2E Banana', 'grams': 118, 'kcal': 105,
    'protein_g': 1.3, 'carbs_g': 26.9, 'fat_g': 0.4, 'source': 'search',
}
ins = f'{URL}/rest/v1/log_entries?on_conflict=user_id,client_id'
for i in (1, 2):  # replay the SAME entry twice — must dedupe server-side
    status, _ = req(ins, 'POST', entry,
        {**user_headers(jwt_a), 'Prefer': 'resolution=ignore-duplicates'})
    print(f'push #{i}: HTTP {status}')

_, rows = req(f'{URL}/rest/v1/log_entries?client_id=eq.{client_id}&select=id,food_name,kcal',
              headers=user_headers(jwt_a))
print(f'rows for client_id (user A sees): {len(rows)} — {rows[0]["food_name"]} {rows[0]["kcal"]} kcal')
assert len(rows) == 1, 'IDEMPOTENCY FAILED'

_, rows_b = req(f'{URL}/rest/v1/log_entries?client_id=eq.{client_id}&select=id',
                headers=user_headers(jwt_b))
print(f'rows visible to user B: {len(rows_b)} (must be 0 — RLS)')
assert len(rows_b) == 0, 'RLS ISOLATION FAILED'

req(f'{URL}/rest/v1/log_entries?client_id=eq.{client_id}', 'DELETE', None, user_headers(jwt_a))
print('cleanup done. ALL LIVE CHECKS PASSED')
