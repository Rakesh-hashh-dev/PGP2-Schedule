# Push Notifications — One-Time Setup

The code is fully wired: students opt in via the **"Enable push"** button on the
Announcements page, subscriptions land in `push_subscriptions`, and admins
broadcast from the **Push Notifications** card in Admin Tools. These steps make
it live.

## 1. Create the table (Supabase SQL Editor)

```sql
create table if not exists push_subscriptions (
  endpoint   text primary key,
  user_id    text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy push_own_select on push_subscriptions
  for select using (auth.jwt()->>'sub' = user_id);
create policy push_own_insert on push_subscriptions
  for insert with check (auth.jwt()->>'sub' = user_id);
create policy push_own_update on push_subscriptions
  for update using (auth.jwt()->>'sub' = user_id);
create policy push_own_delete on push_subscriptions
  for delete using (auth.jwt()->>'sub' = user_id);
```

## 2. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Keep both keys. The **public** key goes to the frontend, the **private** key
only to the edge function.

## 3. Frontend env var

Add to `schedule-app/.env.local` AND to Vercel → Project → Settings → Environment Variables:

```
VITE_VAPID_PUBLIC_KEY=<public key>
```

(Without it the "Enable push" button simply hides itself.)

## 4. Deploy the edge function

```bash
cd "schedule-app"
npx supabase functions deploy send-push --no-verify-jwt --project-ref <your-project-ref>

npx supabase secrets set --project-ref <your-project-ref> \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:mba25rakeshb@iimsambalpur.ac.in \
  PUSH_ADMIN_SECRET=<pick a long random string>
```

`--no-verify-jwt` is needed because the app authenticates with Clerk tokens,
not Supabase Auth. The function is instead protected by `PUSH_ADMIN_SECRET`,
which it requires in the `x-push-key` header.

The Admin Tools broadcast card prompts for this secret once and remembers it in
localStorage (`pgp2.push-admin-key`).

## 5. (Optional) Daily digest at 8:00 AM IST

Run in Supabase SQL Editor (requires `pg_cron` + `pg_net` extensions, enable
them under Database → Extensions):

```sql
select cron.schedule(
  'termflow-daily-digest',
  '30 2 * * 1-6',   -- 02:30 UTC = 08:00 IST, Mon–Sat
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-key', '<PUSH_ADMIN_SECRET>'
    ),
    body := jsonb_build_object('mode', 'digest')
  );
  $$
);
```

## 6. Class reminders (15/30/60 min before class)

Students control this via the "Class reminders" bar on the Announcements page
(visible once push is enabled). Server side:

**a. Tables (SQL Editor):**

```sql
create table if not exists push_prefs (
  user_id         text primary key,
  class_reminders boolean default true,
  lead_minutes    int default 30 check (lead_minutes in (15, 30, 60)),
  updated_at      timestamptz default now()
);
alter table push_prefs enable row level security;
create policy prefs_own_select on push_prefs for select using (auth.jwt()->>'sub' = user_id);
create policy prefs_own_insert on push_prefs for insert with check (auth.jwt()->>'sub' = user_id);
create policy prefs_own_update on push_prefs for update using (auth.jwt()->>'sub' = user_id);

-- service-role only (no client policies needed)
create table if not exists schedule_cache (
  id         text primary key,
  payload    jsonb not null,
  fetched_at timestamptz default now()
);
alter table schedule_cache enable row level security;

create table if not exists reminder_log (
  date    text not null,
  code    text not null,
  section text not null,
  user_id text not null,
  sent_at timestamptz default now(),
  primary key (date, code, section, user_id)
);
alter table reminder_log enable row level security;
```

**b. Deploy + secret:**

```bash
npx supabase functions deploy class-reminders --no-verify-jwt --project-ref <your-project-ref>
npx supabase secrets set --project-ref <your-project-ref> FEED_URL=<Apps Script feed URL from lib/sheet.js>
```

**c. Cron — every 5 min during class hours (needs pg_cron + pg_net extensions):**

```sql
select cron.schedule(
  'termflow-class-reminders',
  '*/5 1-17 * * *',   -- 06:30–23:25 IST
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/class-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-key', '<PUSH_ADMIN_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

How it works: each run fetches the live schedule (cached in `schedule_cache` as
fallback), applies admin class overrides (cancelled classes are skipped), finds
classes whose start time is exactly one lead-window away, matches enrolled
students (`profiles.courses`, "Single" section = everyone in the course),
dedupes via `reminder_log`, and pushes to every device of each matched user.

**Morning summary (same function):** users can also enable a personal daily
digest — "📋 Your Friday: 3 classes" with their day's timetable — at a time of
their choosing (default 07:20, settable 06:30–22:00 on the Announcements page).
Prefs live in `push_prefs.daily_summary` / `summary_time`; dedup uses a
`_summary` row in `reminder_log`. No extra cron needed — the 5-minute job
covers it. Note: times before 06:30 IST won't fire because the cron window
starts at 06:30 IST.

## Test checklist

1. Deploy the app, open the Announcements tab → click **Enable push** → allow.
2. Confirm a row appeared in `push_subscriptions`.
3. Admin Tools → Push Notifications → send a test → notification should arrive
   even with the tab closed.
4. Stale subscriptions (uninstalled PWAs etc.) are auto-pruned on each send.
