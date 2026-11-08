// Read-only schema export is supplied separately; this script mutates only a NEW Docker DB.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const schema=resolve(process.argv[2]||'.local/admin-hosted-schema-20261105.sql');
const sql=readFileSync(schema,'utf8');
if(!sql.includes('CREATE TABLE IF NOT EXISTS "public"."admins"')||/^COPY /m.test(sql)||/^INSERT INTO /m.test(sql))throw Error('Supply a schema-only public dump');
const stamp=Date.now(),database=`admin_upgrade_verify_${stamp}`,container='supabase_db_schedule-app',dir=`/tmp/admin-upgrade-${stamp}`;
const docker=args=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:32*1024*1024});
mkdirSync('.local',{recursive:true});
const bootstrap='.local/admin-upgrade-bootstrap.sql';
writeFileSync(bootstrap,`create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.jwt() to anon,authenticated;
`);
const migrations=readdirSync('supabase/migrations').filter(p=>/^20261104\d+_admin_.*\.sql$/.test(p)).sort().map(p=>'supabase/migrations/'+p);
const files=[bootstrap,schema,'supabase/tests/fixtures/admin_hosted_upgrade_seed.sql',...migrations,'supabase/tests/admin_hosted_upgrade.sql'];
docker(['exec',container,'createdb','-U','postgres',database]);
docker(['exec',container,'mkdir','-p',dir]);
const log=[],hashes={};
try{
 for(const [i,file]of files.entries()){
  hashes[file]=createHash('sha256').update(readFileSync(file)).digest('hex');
  const dest=`${dir}/${i}.sql`;docker(['cp',file,`${container}:${dest}`]);
  log.push(`Applying ${file}\n`+docker(['exec',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-f',dest]));
  console.log(`Passed ${file}`);
 }
 writeFileSync('.local/admin-hosted-upgrade-manifest.json',JSON.stringify({database,at:new Date().toISOString(),hashes},null,2));
 console.log(`Hosted public-schema upgrade passed in ${database}; no hosted data or writes used.`);
}catch(error){log.push(String(error.stderr||error));throw error;}
finally{writeFileSync('.local/admin-hosted-upgrade.log',log.join('\n'));}
