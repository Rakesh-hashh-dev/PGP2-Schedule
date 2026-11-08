// Applies only private, reviewed domain jobs. The RPC rechecks the author's
// current permission and expected revision, and claims due jobs transactionally.
import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (req: Request) => {
  const serviceKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || req.headers.get("authorization") !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const client = createClient(Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!, serviceKey);
  const { data, error } = await client.rpc("admin_apply_due_publications");
  return new Response(JSON.stringify(error ? { error: error.message } : data), {
    status: error ? 500 : 200, headers: { "Content-Type": "application/json" },
  });
});