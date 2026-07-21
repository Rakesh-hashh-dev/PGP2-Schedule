-- ============================================================
-- TermFlow Split — Splitwise-style shared expenses (Tools section)
-- Run in: Supabase Dashboard → SQL Editor (or apply directly via Management API)
-- Additive only; safe on the live app. Run AFTER 20260720120000_board.sql
-- (this migration recreates notif_social_insert with a superset of its list).
--
-- Model:
--   split_groups   — a shared-expense pot (trip, flatmates, cohort). member_ids
--                    is server-side (Clerk subs); the creator manages membership.
--   split_expenses — one expense: a single payer + a split across participants.
--   split_shares   — one row per participant with their RESOLVED owed amount, so
--                    equal / exact / percent / shares all reduce to the same
--                    balance math (Σ shares = expense amount).
--   settlements    — a payment recorded from one member to another (settle up).
--
-- Trust model: mirrors meetups — reads/writes scoped to group members via a
-- membership check against split_groups. Amounts are numeric(12,2); the client
-- resolves shares with largest-remainder rounding so paise sum exactly.
-- ============================================================

-- ── Groups ────────────────────────────────────────────────────────────────────
create table if not exists public.split_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  created_by  text not null,                    -- Clerk subject (auth.jwt()->>'sub')
  created_by_name text,
  member_ids  text[] not null default '{}',     -- all members incl. creator (Clerk subs)
  member_names jsonb not null default '{}',      -- { clerkId: displayName } for rendering
  currency    text not null default '₹',
  created_at  timestamptz not null default now()
);

-- ── Expenses ──────────────────────────────────────────────────────────────────
create table if not exists public.split_expenses (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.split_groups (id) on delete cascade,
  description  text not null check (char_length(description) between 1 and 100),
  amount       numeric(12,2) not null check (amount > 0),
  paid_by      text not null,                   -- Clerk sub of the payer
  split_type   text not null default 'equal' check (split_type in ('equal','exact','percent','shares')),
  category     text,                            -- optional label (Food, Travel, …)
  notes        text check (char_length(notes) <= 300),
  created_by   text not null,                   -- Clerk sub of whoever logged it
  created_at   timestamptz not null default now()
);

-- ── Shares (resolved owed amount per participant) ─────────────────────────────
create table if not exists public.split_shares (
  expense_id  uuid not null references public.split_expenses (id) on delete cascade,
  user_id     text not null,                    -- Clerk sub of the participant
  amount      numeric(12,2) not null check (amount >= 0),
  primary key (expense_id, user_id)
);

-- ── Settlements (settle up) ───────────────────────────────────────────────────
create table if not exists public.settlements (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.split_groups (id) on delete cascade,
  from_user   text not null,                    -- payer (Clerk sub)
  to_user     text not null,                    -- payee (Clerk sub)
  amount      numeric(12,2) not null check (amount > 0),
  note        text check (char_length(note) <= 120),
  created_by  text not null,
  created_at  timestamptz not null default now()
);

alter table public.split_groups   enable row level security;
alter table public.split_expenses enable row level security;
alter table public.split_shares   enable row level security;
alter table public.settlements    enable row level security;

-- Membership helper: is the caller a member of this group?
create or replace function public.is_split_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from split_groups g
    where g.id = p_group_id
      and auth.jwt()->>'sub' = any(g.member_ids)
  );
$$;
grant execute on function public.is_split_member(uuid) to authenticated;

-- ── Groups policies ───────────────────────────────────────────────────────────
-- Visible to members; creator pinned on insert; only the creator edits/deletes
-- (membership changes go through the creator).
drop policy if exists split_groups_select on public.split_groups;
create policy split_groups_select on public.split_groups
  for select using (auth.jwt()->>'sub' = any(member_ids));
drop policy if exists split_groups_insert on public.split_groups;
create policy split_groups_insert on public.split_groups
  for insert with check (
    auth.jwt()->>'sub' = created_by
    and auth.jwt()->>'sub' = any(member_ids)   -- creator must include themselves
  );
drop policy if exists split_groups_update on public.split_groups;
create policy split_groups_update on public.split_groups
  for update using (auth.jwt()->>'sub' = created_by)
  with check (auth.jwt()->>'sub' = created_by);
drop policy if exists split_groups_delete on public.split_groups;
create policy split_groups_delete on public.split_groups
  for delete using (auth.jwt()->>'sub' = created_by);

-- ── Expenses policies ─────────────────────────────────────────────────────────
-- Any group member can read and add expenses; only the logger may edit/delete.
drop policy if exists split_expenses_select on public.split_expenses;
create policy split_expenses_select on public.split_expenses
  for select using (public.is_split_member(group_id));
drop policy if exists split_expenses_insert on public.split_expenses;
create policy split_expenses_insert on public.split_expenses
  for insert with check (
    auth.jwt()->>'sub' = created_by
    and public.is_split_member(group_id)
  );
drop policy if exists split_expenses_update on public.split_expenses;
create policy split_expenses_update on public.split_expenses
  for update using (auth.jwt()->>'sub' = created_by)
  with check (auth.jwt()->>'sub' = created_by);
drop policy if exists split_expenses_delete on public.split_expenses;
create policy split_expenses_delete on public.split_expenses
  for delete using (auth.jwt()->>'sub' = created_by);

-- ── Shares policies ───────────────────────────────────────────────────────────
-- Readable by anyone who can see the parent expense's group; writable only by
-- the person who logged the parent expense (they insert the whole share set).
drop policy if exists split_shares_select on public.split_shares;
create policy split_shares_select on public.split_shares
  for select using (
    exists (
      select 1 from public.split_expenses e
      where e.id = expense_id and public.is_split_member(e.group_id)
    )
  );
drop policy if exists split_shares_write on public.split_shares;
create policy split_shares_write on public.split_shares
  for insert with check (
    exists (
      select 1 from public.split_expenses e
      where e.id = expense_id and e.created_by = auth.jwt()->>'sub'
    )
  );
drop policy if exists split_shares_delete on public.split_shares;
create policy split_shares_delete on public.split_shares
  for delete using (
    exists (
      select 1 from public.split_expenses e
      where e.id = expense_id and e.created_by = auth.jwt()->>'sub'
    )
  );

-- ── Settlements policies ──────────────────────────────────────────────────────
-- Readable by group members; recordable by the payer or payee (the person
-- logging it must be one of the two parties and a group member).
drop policy if exists settlements_select on public.settlements;
create policy settlements_select on public.settlements
  for select using (public.is_split_member(group_id));
drop policy if exists settlements_insert on public.settlements;
create policy settlements_insert on public.settlements
  for insert with check (
    auth.jwt()->>'sub' = created_by
    and (auth.jwt()->>'sub' = from_user or auth.jwt()->>'sub' = to_user)
    and public.is_split_member(group_id)
  );
drop policy if exists settlements_delete on public.settlements;
create policy settlements_delete on public.settlements
  for delete using (auth.jwt()->>'sub' = created_by);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists split_groups_members_idx on public.split_groups using gin (member_ids);
create index if not exists split_expenses_group_idx on public.split_expenses (group_id, created_at desc);
create index if not exists split_shares_expense_idx on public.split_shares (expense_id);
create index if not exists settlements_group_idx on public.settlements (group_id, created_at desc);

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Idempotent adds (a plain `add table` errors if already a member — this whole
-- file is safe to re-run in the SQL Editor).
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='split_groups') then
    alter publication supabase_realtime add table public.split_groups;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='split_expenses') then
    alter publication supabase_realtime add table public.split_expenses;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='split_shares') then
    alter publication supabase_realtime add table public.split_shares;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='settlements') then
    alter publication supabase_realtime add table public.settlements;
  end if;
end $$;

-- ── Client-inserted split notifications ───────────────────────────────────────
-- split_added     (logger → each other participant)
-- split_settled   (payer/payee → the other party)
-- split_reminder  (creditor → a debtor, a "settle up" nudge)
-- data.from_id stays pinned to the caller.
-- NOTE: polls (20260719120000), meetups (20260719140000), board (20260720120000)
-- and this migration all recreate this policy. Each carries the FULL union of
-- client-insertable types so they are safe to run in any order.
drop policy if exists notif_social_insert on public.notifications;
create policy notif_social_insert on public.notifications
  for insert
  with check (
    type in ('friend_request','friend_accepted','group_invite','friend_removed','group_poll',
             'board_contact','meetup_invite','meetup_rsvp','meetup_cancelled',
             'split_added','split_settled','split_reminder')
    and (data->>'from_id') = (auth.jwt()->>'sub')
  );
