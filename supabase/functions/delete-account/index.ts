// Edge Function: delete-account (spec 0008) — GDPR/DPDP erasure.
// Verifies the caller's JWT, then deletes all their rows + the auth user.
import { createClient } from "npm:@supabase/supabase-js@2";

// Browsers preflight this call (it carries Authorization), and unlike
// auth/v1 + rest/v1 — which ship CORS built-in — an Edge Function must
// answer CORS itself. Without this, web callers' DELETE silently dies at
// preflight while native apps (no CORS) work fine. Found 2026-07-28 by the
// headed-Chrome journey; the old sandbox curl bridge had masked it (B-24).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace("Bearer ", "");
  if (!jwt) return reply(401, { error: "no token" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return reply(401, { error: "invalid token" });
  }
  const uid = userData.user.id;

  for (const table of ["log_entries", "water_entries", "weigh_ins", "entitlements", "profiles"]) {
    const col = table === "profiles" ? "id" : "user_id";
    const { error } = await admin.from(table).delete().eq(col, uid);
    if (error) return reply(500, { error: `${table}: ${error.message}` });
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return reply(500, { error: delErr.message });

  return reply(200, { deleted: uid });
});
