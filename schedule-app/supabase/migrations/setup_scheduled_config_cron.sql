-- Run this in: Supabase Dashboard → SQL Editor (after deploying the
-- apply-scheduled-config edge function). Requires pg_cron + pg_net.
-- Replace the placeholders with your values (Project Settings → API).
-- Powers the Admin Tools "Scheduled Deploys" card: applies queued config
-- snapshots (system_config.flags.scheduledConfigDeploys) at their due time.

select cron.schedule(
  'apply-scheduled-config',       -- job name (unique)
  '* * * * *',                    -- every minute
  $$
    select net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/apply-scheduled-config',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- View jobs:      select * from cron.job;
-- Remove later:   select cron.unschedule('apply-scheduled-config');
