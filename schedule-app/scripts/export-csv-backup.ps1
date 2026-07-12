$ErrorActionPreference = 'Stop'

# --- 1. Read Supabase CLI access token from Windows Credential Manager ---
Add-Type -Namespace Win32 -Name Cred -MemberDefinition @"
[DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
public static extern bool CredRead(string target, int type, int flags, out IntPtr credPtr);
[DllImport("advapi32.dll")]
public static extern void CredFree(IntPtr credPtr);
"@

$ptr = [IntPtr]::Zero
if (-not [Win32.Cred]::CredRead("Supabase CLI:supabase", 1, 0, [ref]$ptr)) {
    throw "CredRead failed for 'Supabase CLI:supabase' (error $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
}
try {
    # CREDENTIAL struct (x64): CredentialBlobSize at offset 32, CredentialBlob ptr at offset 40
    $blobSize = [Runtime.InteropServices.Marshal]::ReadInt32($ptr, 32)
    $blobPtr  = [Runtime.InteropServices.Marshal]::ReadIntPtr($ptr, 40)
    $bytes = New-Object byte[] $blobSize
    [Runtime.InteropServices.Marshal]::Copy($blobPtr, $bytes, 0, $blobSize)
} finally {
    [Win32.Cred]::CredFree($ptr)
}

$raw = [Text.Encoding]::UTF8.GetString($bytes)
if ($raw -notmatch 'sbp_[A-Za-z0-9_]+') {
    $raw = [Text.Encoding]::Unicode.GetString($bytes)
    if ($raw -notmatch 'sbp_[A-Za-z0-9_]+') { throw "No sbp_ token found in credential blob ($blobSize bytes)" }
}
$token = $Matches[0]
Write-Host "Token loaded from Credential Manager (sbp_... $($token.Length) chars)"

# --- 2. Export each table to CSV via Management API ---
$projectRef = 'fzhfbttlbfpnwhempyav'
$uri = "https://api.supabase.com/v1/projects/$projectRef/database/query"
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$outDir = "F:\Web Dev\Antigravity\supabase-backups\$stamp"
New-Item -ItemType Directory -Force $outDir | Out-Null

$tables = @('_migration_map','admin_audit_logs','attendance','daily_stats','feedback',
            'friend_pings','profiles','push_prefs','push_subscriptions','reminder_log',
            'schedule_cache','share_codes','system_config')

$summary = @()
foreach ($t in $tables) {
    $body = @{ query = "select * from public.""$t""" } | ConvertTo-Json
    $resp = Invoke-WebRequest -Method Post -Uri $uri -Headers $headers -Body $body
    $rows = [object[]]($resp.Content | ConvertFrom-Json -NoEnumerate)

    if ($rows.Count -eq 0) {
        Set-Content -Path (Join-Path $outDir "$t.csv") -Value "(table is empty)"
        $summary += [pscustomobject]@{ table = $t; rows = 0 }
        continue
    }

    # Flatten: nested objects/arrays (JSONB columns) -> compact JSON strings
    $flat = foreach ($r in $rows) {
        $o = [ordered]@{}
        foreach ($p in $r.PSObject.Properties) {
            $v = $p.Value
            if ($null -eq $v) { $o[$p.Name] = '' }
            elseif ($v -is [string] -or $v -is [bool] -or $v.GetType().IsPrimitive -or $v -is [decimal] -or $v -is [datetime]) { $o[$p.Name] = $v }
            else { $o[$p.Name] = ($v | ConvertTo-Json -Compress -Depth 25) }
        }
        [pscustomobject]$o
    }
    $flat | Export-Csv -Path (Join-Path $outDir "$t.csv") -NoTypeInformation -Encoding UTF8
    $summary += [pscustomobject]@{ table = $t; rows = $rows.Count }
}

Write-Host "`nExported to $outDir"
$summary | Format-Table -AutoSize
