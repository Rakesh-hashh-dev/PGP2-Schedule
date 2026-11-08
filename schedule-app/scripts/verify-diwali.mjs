// Real PostgreSQL in memory. Uses the same isolated moderation fixtures as admin QA.
import { readFileSync } from 'node:fs';
import { PGlite } from '../.local/notification-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  for (const name of ['admin_baseline','admin_moderation_sources']) await db.exec(readFileSync(`supabase/tests/fixtures/${name}.sql`,'utf8'));
  for (const name of ['20261102120000_admin_app_controls','20261104120000_admin_private_notes','20261104121000_admin_capabilities','20261104122000_admin_domain_publication','20261104123000_admin_draft_recovery','20261104124000_admin_content_moderation']) await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'));
  await db.exec("alter table public.board_posts add column kind text not null default 'lost' check(kind in ('lost','found','sell','ask')), add column price int, add column contact text; grant insert on public.board_posts to authenticated; create policy board_insert on public.board_posts for insert to authenticated with check(user_id=auth.jwt()->>'sub');");
  await db.exec(readFileSync('supabase/migrations/20261108130000_campus_celebrations.sql','utf8'));
  await db.exec(readFileSync('supabase/tests/campus_celebrations.sql','utf8'));
  console.log('Celebration constraints, ownership, reporting, automatic hiding, and moderation privacy passed.');
} finally { await db.close(); }
