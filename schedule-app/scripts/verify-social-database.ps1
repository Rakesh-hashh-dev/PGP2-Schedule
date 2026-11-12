param([string]$Image = 'postgres:17-alpine', [string]$ReleaseBundle = '')
$ErrorActionPreference = 'Stop'
$qaName = 'termflow-social-qa-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$appRoot = Split-Path $PSScriptRoot -Parent

# Disposable PostgreSQL only: no host mounts, published ports or production credentials.
# auth.jwt and profile prerequisites below emulate the relevant Supabase contracts.
# The actual project migrations and rollback-only assertions run unchanged.
function Invoke-QaSql([string]$Sql, [string]$Label) {
    Write-Output "Checking $Label"
    $Sql | docker exec -i $qaName psql -U postgres -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw "Database verification failed: $Label" }
}
function Invoke-QaFile([string]$Relative) {
    Invoke-QaSql (Get-Content -LiteralPath (Join-Path $appRoot $Relative) -Raw) $Relative
}

try {
    $containerId = docker run --rm --name $qaName --network none --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=local-disposable-test-only -d $Image -c wal_level=logical
    if ($LASTEXITCODE -ne 0) { throw 'Could not start disposable PostgreSQL.' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        docker exec $qaName pg_isready -U postgres *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Disposable PostgreSQL did not become ready.' }
    Invoke-QaSql @'
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.jwt() to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
alter default privileges in schema public grant usage,select on sequences to anon,authenticated,service_role;
create table public.profiles(user_id text primary key,courses jsonb default '{}',groups jsonb default '[]',friends jsonb default '[]',updated_at timestamptz default now());
create publication supabase_realtime;
'@ 'isolated Supabase auth/profile prerequisites'
    foreach ($migration in @(
        '20260716120000_notifications_table.sql',
        '20260717120000_social_notifications.sql',
        '20260719120000_polls.sql',
        '20260719140000_meetups.sql',
        '20260721000000_group_chat_rls.sql',
        '20260923120000_study_group_invites.sql',
        '20261008120000_social_workspace_upgrades.sql'
    )) { Invoke-QaFile "supabase/migrations/$migration" }
    Invoke-QaSql @'
alter table public.group_messages add column moderation_hidden boolean not null default false;
alter table public.polls add column moderation_hidden boolean not null default false;
create policy moderation_message_visibility on public.group_messages as restrictive for select to authenticated using(not moderation_hidden or from_id=auth.jwt()->>'sub');
'@ 'existing moderation prerequisites'
    if ($ReleaseBundle) {
        Invoke-QaSql 'create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);' 'isolated migration history prerequisites'
        Invoke-QaFile $ReleaseBundle
        Invoke-QaFile 'supabase/tests/social_plan_proposals.sql'
    } else {
        Invoke-QaFile 'supabase/migrations/20261111130000_social_plan_proposals.sql'
        Invoke-QaFile 'supabase/tests/social_plan_proposals.sql'
        Invoke-QaFile 'supabase/migrations/20261111140000_social_group_chat.sql'
        Invoke-QaFile 'supabase/migrations/20261111150000_social_availability_lifecycle.sql'
    }
    Invoke-QaFile 'supabase/tests/social_function_privileges.sql'
    Invoke-QaFile 'supabase/tests/social_legacy_compatibility.sql'
    Invoke-QaFile 'supabase/operations/social-lifecycle-rpc-cutover.sql'
    Invoke-QaFile 'supabase/tests/social_availability_lifecycle.sql'
    Invoke-QaFile 'supabase/tests/social_group_chat.sql'
    Write-Output 'PASS: Social migrations and database behavior assertions.'
} finally {
    docker stop $qaName 2>$null | Out-Null
}
