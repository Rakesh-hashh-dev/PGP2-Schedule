// Applies only private, reviewed domain jobs. The RPC rechecks the author's
// current permission and expected revision, and claims due jobs transactionally.
import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (req: Request) => {
  const serviceKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization");
  if (!serviceKey || !authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  // Forward the caller's credential so PostgREST validates its signature and
  // admin_apply_due_publications enforces service_role. Cron credentials may
  // differ from the runtime-injected key after a platform key rotation.
  const client = createClient(Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!, serviceKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("admin_apply_due_publications");
  return new Response(JSON.stringify(error ? { error: error.message } : data), {
    status: error ? (error.code === '42501' || error.code === 'PGRST301' ? 401 : 500) : 200,
    headers: { "Content-Type": "application/json" },
  });
});
