# Automated push: morning summaries and class reminders

These alerts use two scheduled functions. `class-reminders` writes due rows to
`notifications`; `dispatch` sends those rows to subscribed devices. A local
notification test only checks the device and does not verify this chain.

## Live diagnosis on 24 September 2026

Both cron jobs were active, but pg_net recorded HTTP 401 `Unauthorized` for
their requests. Neither `daily_summary` nor `class_reminder` had produced a row
since 14 August. The Edge Function `PUSH_ADMIN_SECRET` had been updated on 14
August; the keys in the cron commands no longer matched it. Cron therefore
submitted requests successfully, but the functions rejected them.

On 24 September, the production `PUSH_ADMIN_SECRET` was rotated to a fresh
random value and the `termflow-class-reminders`, `termflow-dispatch`, and
`termflow-schedule-diff` cron commands were updated to match. The three active
jobs' key digests match the function secret. pg_net returned HTTP 200 for
dispatch, a direct class-reminders run at 05:12 IST, and a direct
schedule-diff run at 05:15 IST. This verifies
authentication and invocation, not receipt of a due morning summary or class
reminder. Check the next scheduled due alert for row creation, delivery, and
device receipt. Old missed reminders should not be replayed after class time.

If rotating again, update all three jobs together. Do not print or share the
secret in logs, screenshots, or a repository file.

## Check the live system

In Admin Tools → Insights → **Run self-test**, check that the
`termflow-class-reminders` and `termflow-dispatch` cron jobs exist, are active,
and ran successfully within their scheduled windows. The test also checks that both edge
functions respond. A cron `succeeded` result means pg_net submitted an HTTP
request; inspect the function logs for the background result.

In Supabase SQL Editor, inspect the jobs and recent responses:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname in ('termflow-class-reminders', 'termflow-dispatch');

select j.jobname, r.start_time, r.status, r.return_message
from cron.job j
join cron.job_run_details r on r.jobid = j.jobid
where j.jobname in ('termflow-class-reminders', 'termflow-dispatch')
order by r.start_time desc
limit 20;
```

For a specific missed alert, check whether its `notifications` row exists.
No row means inspect the `class-reminders` logs, feed, course enrollment,
`push_prefs`, and subscription. A row with null `delivered_push_at` means
inspect `dispatch` logs, VAPID secrets, and the device subscription.

```sql
select type, title, created_at, delivered_push_at, data
from public.notifications
where user_id = '<CLERK_USER_ID>'
  and type in ('daily_summary', 'class_reminder')
order by created_at desc
limit 20;
```

## Restore the scheduled chain

Deploy both current functions with JWT verification disabled because cron
authenticates through `PUSH_ADMIN_SECRET` in `x-push-key`:

```text
npx supabase functions deploy class-reminders --no-verify-jwt --project-ref <PROJECT_REF>
npx supabase functions deploy dispatch --no-verify-jwt --project-ref <PROJECT_REF>
```

Ensure `PUSH_ADMIN_SECRET` is set for both functions. `class-reminders` also
needs `FEED_URL`. `dispatch` needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
and `VAPID_SUBJECT`. The frontend public key must match the server key pair.

Create or repair these jobs in Supabase SQL Editor. Replace the placeholders;
do not store real keys in this repository. If an existing job has a different
name, inspect and unschedule that old job to avoid duplicate invocations.

```sql
select cron.schedule(
  'termflow-class-reminders', '*/5 1-17 * * *',
  $$select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/class-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-key', '<PUSH_ADMIN_SECRET>'),
    body := '{}'::jsonb
  )$$
);

select cron.schedule(
  'termflow-dispatch', '* * * * *',
  $$select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-key', '<PUSH_ADMIN_SECRET>'),
    body := '{}'::jsonb
  )$$
);
```

Verify the next due reminder creates one row, then `dispatch` stamps
`delivered_push_at` and the device receives it. The default morning summary is
07:20 IST when enabled. The default class reminder is 30 minutes before the
class. The producer scans every five minutes and catches triggers up to 15
minutes late; dispatch runs every minute. If no class falls in the current
window, use an admin test push to verify dispatch without waiting for a class.
