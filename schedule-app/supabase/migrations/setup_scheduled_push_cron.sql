-- Run this in: Supabase Dashboard → SQL Editor
-- Requires: pg_cron and pg_net extensions (both enabled by default on Supabase Pro/paid plans)
-- Replace the placeholders below with your actual values (Supabase Project Settings → API)

select cron.schedule(
  'dispatch-scheduled-pushes',   -- job name (unique)
  '* * * * *',                   -- every minute
  $$
    select net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/dispatch-scheduled-pushes',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
        'x-admin-key',   'YOUR_PUSH_ADMIN_SECRET'
      ),
      body    := '{}''::jsonb
    )
  $$
);

-- To view scheduled jobs:
-- select * from cron.job;

-- To remove the job later:
-- select cron.unschedule(''dispatch-scheduled-pushes'');
