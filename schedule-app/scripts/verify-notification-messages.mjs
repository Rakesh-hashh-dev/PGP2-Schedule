// Executes real PostgreSQL in memory; never connects to Supabase.
// npm install --prefix .local/notification-sql-runtime --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { scheduleNoticeCopy } from '../supabase/functions/_shared/notificationCopy.js';
import { PGlite } from '../.local/notification-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const fixtures = ['admin_baseline', 'admin_moderation_sources', 'admin_publication_notice_sources', 'admin_notification_sources', 'admin_support_sources'];
  for (const name of fixtures) await db.exec(readFileSync(`supabase/tests/fixtures/${name}.sql`, 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261102120000_admin_app_controls.sql', 'utf8'));
  await db.exec(readFileSync('supabase/tests/fixtures/admin_legacy_control_drafts.sql', 'utf8'));
  const migrations = ['20261104120000_admin_private_notes', '20261104121000_admin_capabilities', '20261104122000_admin_domain_publication', '20261104123000_admin_draft_recovery', '20261104124000_admin_content_moderation', '20261104124500_admin_role_presets', '20261104125000_admin_notification_diagnostics', '20261104130000_admin_publication_notifications', '20261108120000_notification_message_copy'];
  for (const name of migrations) await db.exec(readFileSync(`supabase/migrations/${name}.sql`, 'utf8'));
  for (const name of ['admin_publication_notifications', 'notification_message_copy']) {
    await db.exec(readFileSync(`supabase/tests/${name}.sql`, 'utf8'));
    console.log(`${name}: passed`);
  }
  const { rows: [dates] } = await db.query("select ((now() at time zone 'Asia/Kolkata')::date)::text today, ((now() at time zone 'Asia/Kolkata')::date+1)::text tomorrow");
  const original = { start: '09:00', end: '10:00', room: 'A101', section: 'A', type: 'class' };
  for (const effective of [
    { ...original, start: '10:30' }, { ...original, room: 'B203' },
    { ...original, type: 'cancelled' }, { ...original, end: '11:00' },
    { start: '09:00', section: 'Single' },
  ]) {
    const target = { code: 'BMD', date: dates.tomorrow, section: 'All', before: original, effective };
    const { rows: [result] } = await db.query('select admin_internal.schedule_notice_copy($1::jsonb,$2::text) copy', [JSON.stringify(target), 'Please check.']);
    assert.deepEqual(result.copy, scheduleNoticeCopy({ ...target, note: 'Please check.', today: dates.today }));
  }
  console.log('SQL and JavaScript message parity: 5 scenarios passed');
} finally { await db.close(); }
