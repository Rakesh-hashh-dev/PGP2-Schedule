// Runs against a NEW local Docker database; never the app or linked project DB.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const suffix=Date.now().toString(),database=`admin_tools_verify_${suffix}`,directory=`/tmp/admin-tools-${suffix}`;
const container='supabase_db_schedule-app';
if(!/^admin_tools_verify_[0-9]+$/.test(database)) throw new Error('Unsafe verification database name');
const docker=args=>execFileSync('docker',args,{cwd,stdio:'inherit'});
const fixtures=['admin_baseline','admin_moderation_sources','admin_publication_notice_sources','admin_notification_sources','admin_support_sources'];
const steps=fixtures.map(name=>`supabase/tests/fixtures/${name}.sql`);
steps.push('supabase/migrations/20261102120000_admin_app_controls.sql');
steps.push('supabase/tests/fixtures/admin_legacy_control_drafts.sql');
const plans=[
  ['20261104120000_admin_private_notes','admin_private_notes'],
  ['20261104121000_admin_capabilities','admin_capabilities'],
  ['20261104122000_admin_domain_publication','admin_domain_publication'],
  ['20261104123000_admin_draft_recovery','admin_draft_recovery'],
  ['20261104124000_admin_content_moderation','admin_content_moderation'],
  ['20261104124500_admin_role_presets','admin_role_presets'],
  ['20261104125000_admin_notification_diagnostics','admin_notification_diagnostics'],
  ['20261104130000_admin_publication_notifications','admin_publication_notifications'],
  ['20261104131000_admin_operational_search','admin_operational_search'],
  ['20261104132000_admin_student_support','admin_student_support'],
];
for(const [migration,test] of plans) steps.push(`supabase/migrations/${migration}.sql`,`supabase/tests/${test}.sql`);
docker(['exec',container,'createdb','-U','postgres',database]);
docker(['exec',container,'mkdir','-p',directory]);
const files=[];
const hashes={};
for(const [index,path] of steps.entries()) {
  hashes[path]=createHash('sha256').update(readFileSync(join(cwd,path))).digest('hex');
  const destination=`${directory}/${index}.sql`;
  docker(['cp',path,`${container}:${destination}`]);files.push('-f',destination);
}
const output=execFileSync('docker',['exec',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1',...files],{cwd,encoding:'utf8',maxBuffer:16*1024*1024});
mkdirSync(join(cwd,'.local'),{recursive:true});
writeFileSync(join(cwd,'.local','admin-enhancement-sql-verification.log'),output);
writeFileSync(join(cwd,'.local','admin-enhancement-sql-manifest.json'),JSON.stringify({database,at:new Date().toISOString(),hashes},null,2));
console.log(`All ${plans.length} admin migration suites passed. Isolated evidence database: ${database}. Full log: .local/admin-enhancement-sql-verification.log`);
