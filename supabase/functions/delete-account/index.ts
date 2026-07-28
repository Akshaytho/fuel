// Edge Function: delete-account (spec 0008) — GDPR/DPDP erasure.
// Verifies the caller's JWT, then deletes all their rows + the auth user.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace("Bearer ", "");
  if (!jwt) return new Response(JSON.stringify({ error: "no token" }), { status: 401 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), { status: 401 });
  }
  const uid = userData.user.id;

  for (const table of ["log_entries", "weigh_ins", "entitlements", "profiles"]) {
    const col = table === "profiles" ? "id" : "user_id";
    const { error } = await admin.from(table).delete().eq(col, uid);
    if (error) return new Response(JSON.stringify({ error: `${table}: ${error.message}` }), { status: 500 });
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500 });

  return new Response(JSON.stringify({ deleted: uid }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
