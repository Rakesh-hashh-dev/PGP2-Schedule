-- Run in: Supabase Dashboard → SQL Editor (after deploying the health-monitor
-- edge function). Requires pg_cron + pg_net. Powers admin-only health alerts:
-- every 15 min the function checks cron jobs + the Sheets feed and pushes an
-- alert to system_config.flags.alertRecipients (+ adminRoles). No recipients =
-- no-op, so it never messages students.
-- Replace the placeholders (Project Settings → API). The anon key is sufficient
-- to pass the platform JWT gate; swap to the service-role key if you prefer.

select cron.schedule(
  'health-monitor',               -- job name (unique)
  '*/15 * * * *',                 -- every 15 minutes
  $$
    select net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/health-monitor',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer YOUR_ANON_OR_SERVICE_KEY'
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- View jobs:      select * from cron.job;
-- Remove later:   select cron.unschedule('health-monitor');
