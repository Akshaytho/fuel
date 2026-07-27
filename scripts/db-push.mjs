// Apply supabase/migrations/*.sql in order, tracking applied ones.
// Works both directly (local machine) and through an HTTPS CONNECT proxy
// (Claude cloud sandbox) — set via https_proxy env automatically.
// Usage: node scripts/db-push.mjs
import 'dotenv/config';
import net from 'net';
import { readdirSync, readFileSync } from 'fs';
import pg from 'pg';

const { SUPABASE_DB_HOST, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, SUPABASE_DB_NAME = 'postgres' } = process.env;
if (!SUPABASE_DB_HOST || !SUPABASE_DB_USER || !SUPABASE_DB_PASSWORD) {
  console.error('Missing SUPABASE_DB_* in .env'); process.exit(1);
}
const DB_PORT = 5432; // session pooler (DDL-safe)

function tunnelStream() {
  // If an egress proxy is present, tunnel TCP through HTTP CONNECT.
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  if (!proxy) return undefined; // let pg connect directly
  const { hostname, port } = new URL(proxy);
  return () => {
    const sock = new net.Socket();
    const realConnect = sock.connect.bind(sock);
    sock.connect = () => {
      realConnect(Number(port), hostname, () => {
        sock.write(`CONNECT ${SUPABASE_DB_HOST}:${DB_PORT} HTTP/1.1\r\nHost: ${SUPABASE_DB_HOST}:${DB_PORT}\r\n\r\n`);
        sock.once('data', (d) => {
          if (String(d).startsWith('HTTP/1.1 200')) sock.emit('connect');
          else sock.destroy(new Error('proxy CONNECT failed: ' + String(d).split('\r\n')[0]));
        });
      });
      return sock;
    };
    return sock;
  };
}

const stream = tunnelStream();
const client = new pg.Client({
  host: SUPABASE_DB_HOST, port: DB_PORT, user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD, database: SUPABASE_DB_NAME,
  // direct (laptop): TLS required by pooler; via cloud proxy: blocked entirely — use Management API instead (docs/SETUP.md)
  ssl: stream ? false : { rejectUnauthorized: false },
  ...(stream ? { stream } : {}),
});

await client.connect();
await client.query(`create table if not exists public._fuel_migrations (
  name text primary key, applied_at timestamptz not null default now())`);

const applied = new Set((await client.query('select name from public._fuel_migrations')).rows.map(r => r.name));
const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
for (const f of files) {
  if (applied.has(f)) { console.log('skip (applied):', f); continue; }
  console.log('applying:', f);
  await client.query('begin');
  try {
    await client.query(readFileSync('supabase/migrations/' + f, 'utf8'));
    await client.query('insert into public._fuel_migrations (name) values ($1)', [f]);
    await client.query('commit');
    console.log('applied:', f);
  } catch (e) {
    await client.query('rollback');
    console.error('FAILED:', f, '-', e.message);
    process.exit(1);
  }
}
const tables = await client.query(`select table_name from information_schema.tables where table_schema='public' order by 1`);
console.log('public tables:', tables.rows.map(r => r.table_name).join(', '));
await client.end();
