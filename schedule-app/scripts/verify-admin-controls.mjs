// Isolated PostgreSQL verification. No connection to a hosted database.
// Usage: node scripts/verify-admin-controls.mjs <path-to-pglite-dist/index.js>
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
process.on('uncaughtException', error => { console.error(`PostgreSQL verification failed: ${error.message} (${error.code || ''}, position ${error.position || ''})`); process.exit(1); });
if (!process.argv[2]) throw new Error('Supply the temporary PGlite module path.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
let count = 0;
await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth to anon, authenticated;
 create table public.admins(user_id text primary key, role text);
 insert into public.admins values ('super','superadmin'),('monitor','monitor');
 create table public.admin_audit_logs(admin_id text,action text,details jsonb);
`);
// Use the project's role helpers rather than approximating their semantics.
const roleMigration = await readFile('supabase/migrations/20260906120000_admin_roles_and_draft_store.sql', 'utf8');
for (const name of ['admin_role', 'is_admin', 'can_write_config']) {
  const match = roleMigration.match(new RegExp(`create or replace function public\\.${name}\\(\\)[\\s\\S]*?\\$\\$;`, 'i'));
  assert.ok(match); await db.exec(match[0]);
}
await db.exec(await readFile('supabase/migrations/20261102120000_admin_app_controls.sql', 'utf8'));
async function asUser(id, sql, params = []) {
  await db.exec('begin; set local role authenticated;');
  try { await db.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id })]); const r = await db.query(sql, params); await db.exec('commit'); return r; }
  catch (e) { await db.exec('rollback'); throw e; }
}
async function denied(id, sql, params = []) { await assert.rejects(asUser(id, sql, params)); count++; }
const publish = (id, section, payload, rev) => asUser(id, 'select public.admin_publish_controls($1,$2::jsonb,$3)', [section, JSON.stringify(payload), rev]);
assert.equal((await asUser('student','select * from public.app_controls')).rows.length,1); count++;
for (const table of ['app_controls_drafts','app_controls_versions']) { assert.equal((await asUser('student',`select * from public.${table}`)).rows.length,0); count++; }
for (const who of ['student','monitor']) {
  await assert.rejects(publish(who,'dashboard',{ density:'compact' },0)); count++;
  await denied(who,'select public.admin_save_controls_draft($1,$2::jsonb,0)',['dashboard','{"density":"compact"}']);
}
await denied('super',"update public.app_controls set payload='{}'");
await asUser('super', 'select public.admin_save_controls_draft($1,$2::jsonb,0)', ['dashboard','{"density":"compact"}']);
assert.equal((await asUser('monitor','select * from public.app_controls_drafts')).rows.length,1); count++;
assert.equal((await asUser('student','select * from public.app_controls_drafts')).rows.length,0); count++;
assert.equal((await publish('super','dashboard',{density:'compact'},0)).rows[0].admin_publish_controls,1); count++;
assert.equal((await asUser('super','select * from public.app_controls_drafts')).rows.length,0); count++;
for (const [section,payload] of [
  ['mess',{anchor:'2026-11-03'}], ['mess',{anchor:null}], ['mess',{dates:{'2026-02-30':{lunch:[]}}}],
  ['mess',{weekly:{1:{lunch:['']}}}], ['mess',{weekly:{1:{lunch:['Rice','Rice']}}}], ['mess',{feedUrl:'https://example.com'}],
  ['mess',{timings:{lunch:{start:'10:00',end:'13:00'}}}], ['mess',{datedTimings:{'2026-11-02':{dinner:{start:'12:00',end:'14:00'}}}}],
  ['mess',{notices:[{id:'n',text:'notice',start:'2026-11-02T10:00',end:'2026-11-02T12:00'}]}],
  ['navigation',{items:{today:{visible:false}}}], ['navigation',{items:{admin:{visible:true}}}], ['navigation',{order:['today','today']}],
  ['dashboard',{visible:{timeline:false}}], ['dashboard',{density:null}], ['dashboard',{order:['bad']}],
]) { await assert.rejects(publish('super',section,payload,1)); count++; }
await assert.rejects(publish('super','dashboard',{density:'comfortable'},0)); count++;
await assert.rejects(publish('super','dashboard',{density:'comfortable'},null)); count++;
await publish('super','mess',{anchor:'2026-11-02',weekly:{1:{lunch:['Rice']}},dates:{'2026-11-03':{dinner:[]}},timings:{lunch:{start:'12:00',end:'14:00'}},notices:[{id:'a',text:'Special meal',start:'2026-11-02T10:00:00+05:30',end:'2026-11-02T12:00:00+05:30'}]},1); count++;
await publish('super','navigation',{items:{split:{label:'Expenses',visible:false}},order:['today','split']},2); count++;
const old = (await asUser('super','select payload from public.app_controls_versions where revision=1')).rows[0].payload.dashboard;
await publish('super','dashboard',old,3); count++;
const row = (await asUser('student','select * from public.app_controls')).rows[0];
assert.equal(row.revision,4); assert.equal(row.payload.dashboard.density,'compact'); assert.equal(row.payload.navigation.items.split.visible,false); count++;
assert.equal((await db.query('select * from public.admin_audit_logs')).rows.length,4); count++;
assert.equal((await asUser('monitor','select * from public.app_controls_versions')).rows.length,4); count++;
// An audit failure must roll back publication and history together.
await db.exec("create function reject_controls_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$; create trigger test_audit before insert on public.admin_audit_logs for each row execute function reject_controls_audit();");
await assert.rejects(publish('super','dashboard',{density:'comfortable'},4)); count++;
assert.equal((await asUser('student','select revision from public.app_controls')).rows[0].revision,4); count++;
assert.equal((await asUser('monitor','select * from public.app_controls_versions')).rows.length,4); count++;
await db.close();
console.log(`${count} PostgreSQL assertions passed (isolated PGlite; actual role helpers and migration).`);
