// Supabase Edge Function: get-metrics
// Fetches Prometheus metrics from the Supabase privileged metrics endpoint
// and parses them into a generic JSON array for the Admin Dashboard.
//
// Auth: requests must carry header x-admin-key: <ADMIN_SECRET>
// Secrets required: PUSH_ADMIN_SECRET or ADMIN_SECRET
// 

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function parsePrometheus(text: string) {
  const lines = text.split('\n');
  const metrics = [];
  
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    
    // matches: metric_name{label="value"} 123.4
    // or: metric_name 123.4
    const match = line.match(/^([a-zA-Z0-9_:]+)(?:\{([^}]+)\})?\s+(.+)$/);
    if (match) {
      const name = match[1];
      const labelsStr = match[2];
      const valueStr = match[3].split(' ')[0]; // sometimes there's a timestamp at the end
      const value = parseFloat(valueStr);
      
      const labels: Record<string, string> = {};
      if (labelsStr) {
        const labelMatches = [...labelsStr.matchAll(/([a-zA-Z0-9_]+)="([^"]*)"/g)];
        for (const lm of labelMatches) {
          labels[lm[1]] = lm[2];
        }
      }
      metrics.push({ name, labels, value });
    }
  }
  return metrics;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const adminSecret = Deno.env.get("ADMIN_SECRET") || Deno.env.get("PUSH_ADMIN_SECRET");
  const requestKey = req.headers.get("x-admin-key");
  
  if (!adminSecret || requestKey !== adminSecret) {
    return json(401, { error: "Unauthorized" });
  }

  // Use the local project's URL and Service Role Key
  const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase env vars" });
  }

  const metricsUrl = `${supabaseUrl}/customer/v1/privileged/metrics`;

  try {
    const resp = await fetch(metricsUrl, {
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`
      }
    });

    if (!resp.ok) {
      // Fallback to basic auth if Bearer is rejected
      if (resp.status === 401) {
        const basicAuth = btoa(`:${serviceRoleKey}`);
        const basicResp = await fetch(metricsUrl, {
          headers: {
            "Authorization": `Basic ${basicAuth}`
          }
        });
        
        if (!basicResp.ok) {
           return json(basicResp.status, { error: `Metrics API failed: ${basicResp.statusText}` });
        }
        
        const text = await basicResp.text();
        return json(200, { metrics: parsePrometheus(text) });
      }
      
      return json(resp.status, { error: `Metrics API failed: ${resp.statusText}` });
    }

    const text = await resp.text();
    return json(200, { metrics: parsePrometheus(text) });

  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
