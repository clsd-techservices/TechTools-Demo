/*
 * Remediation Generator - ready-made script pairs
 * -------------------------------------------------------------
 * Used by demo mode (and as one-click examples in the kit). {{tokens}} are filled
 * from kit-config.js, so the Author / Publisher / log path match the district.
 *
 * Copyright (c) 2026 Scott Boyer, Systems Coordinator, CLSD Technology Services. MIT License (see LICENSE).
 */
window.REMEDIATION_PRESETS = [
{
  id: 'block-social',
  label: 'Block social media domains',
  prompt: 'Block Facebook, Instagram, and TikTok on student devices by adding hosts file entries.',
  summary: 'Detects whether the hosts file blocks the listed social media domains and adds any missing 0.0.0.0 entries without touching existing lines.',
  detection: String.raw`<#
.SYNOPSIS   Detect: social media domains blocked in hosts file
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$Domains = @('facebook.com','www.facebook.com','instagram.com','www.instagram.com','tiktok.com','www.tiktok.com')
$Hosts   = "$env:SystemRoot\System32\drivers\etc\hosts"

try {
    $content = Get-Content -Path $Hosts -ErrorAction Stop
    $missing = foreach ($d in $Domains) {
        if (-not ($content -match "^\s*0\.0\.0\.0\s+$([regex]::Escape($d))\s*$")) { $d }
    }
    if ($missing) {
        Write-Output "Non-compliant: missing $($missing.Count) entr(ies): $($missing -join ', ')"
        exit 1
    }
    Write-Output "Compliant: all $($Domains.Count) domains blocked"
    exit 0
}
catch {
    Write-Output "Detection error: $($_.Exception.Message)"
    exit 1
}`,
  remediation: String.raw`<#
.SYNOPSIS   Remediate: add social media blocks to hosts file
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$Domains = @('facebook.com','www.facebook.com','instagram.com','www.instagram.com','tiktok.com','www.tiktok.com')
$Hosts   = "$env:SystemRoot\System32\drivers\etc\hosts"
$LogDir  = "$env:ProgramData\{{logFolder}}\IntuneLogs"
$Log     = Join-Path $LogDir 'Block-SocialMedia.log'

function Write-Log($m) { $line = "$(Get-Date -Format s)  $m"; Write-Output $line; Add-Content -Path $Log -Value $line }

try {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    Copy-Item -Path $Hosts -Destination "$Hosts.bak" -Force
    Write-Log "Backed up hosts file to hosts.bak"

    $content = Get-Content -Path $Hosts -ErrorAction Stop
    $added = 0
    foreach ($d in $Domains) {
        if (-not ($content -match "^\s*0\.0\.0\.0\s+$([regex]::Escape($d))\s*$")) {
            Add-Content -Path $Hosts -Value "0.0.0.0 $d" -Encoding ASCII
            $added++
        }
    }
    ipconfig /flushdns | Out-Null
    Write-Log "Added $added entr(ies); DNS cache flushed"
    exit 0
}
catch {
    Write-Log "Remediation failed: $($_.Exception.Message)"
    exit 1
}`
},
{
  id: 'bloatware',
  label: 'Remove consumer bloatware',
  prompt: 'Remove consumer bloatware apps (Xbox, Bing News, Solitaire, Clipchamp, etc.) for all users and stop them from reinstalling for new users.',
  summary: 'Finds the listed consumer Store apps for any user or in the provisioned image and removes both, so they don\u2019t come back for new sign-ins.',
  detection: String.raw`<#
.SYNOPSIS   Detect: consumer bloatware present
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$Apps = @(
    'Microsoft.BingNews','Microsoft.BingWeather','Microsoft.GamingApp','Microsoft.XboxApp',
    'Microsoft.Xbox.TCUI','Microsoft.XboxGamingOverlay','Microsoft.MicrosoftSolitaireCollection',
    'Microsoft.ZuneMusic','Microsoft.ZuneVideo','Clipchamp.Clipchamp','Microsoft.People'
)
try {
    $installed   = Get-AppxPackage -AllUsers | Where-Object { $Apps -contains $_.Name }
    $provisioned = Get-AppxProvisionedPackage -Online | Where-Object { $Apps -contains $_.DisplayName }
    $found = @($installed.Name) + @($provisioned.DisplayName) | Where-Object { $_ } | Sort-Object -Unique
    if ($found) {
        Write-Output "Non-compliant: $($found.Count) app(s) present: $($found -join ', ')"
        exit 1
    }
    Write-Output "Compliant: no listed apps found"
    exit 0
}
catch {
    Write-Output "Detection error: $($_.Exception.Message)"
    exit 1
}`,
  remediation: String.raw`<#
.SYNOPSIS   Remediate: remove consumer bloatware (installed + provisioned)
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$Apps = @(
    'Microsoft.BingNews','Microsoft.BingWeather','Microsoft.GamingApp','Microsoft.XboxApp',
    'Microsoft.Xbox.TCUI','Microsoft.XboxGamingOverlay','Microsoft.MicrosoftSolitaireCollection',
    'Microsoft.ZuneMusic','Microsoft.ZuneVideo','Clipchamp.Clipchamp','Microsoft.People'
)
$LogDir = "$env:ProgramData\{{logFolder}}\IntuneLogs"
$Log    = Join-Path $LogDir 'Remove-Bloatware.log'
function Write-Log($m) { $line = "$(Get-Date -Format s)  $m"; Write-Output $line; Add-Content -Path $Log -Value $line }

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$failed = 0
foreach ($app in $Apps) {
    try {
        Get-AppxPackage -AllUsers -Name $app | ForEach-Object {
            Remove-AppxPackage -Package $_.PackageFullName -AllUsers -ErrorAction Stop
            Write-Log "Removed installed package $($_.Name)"
        }
        Get-AppxProvisionedPackage -Online | Where-Object DisplayName -eq $app | ForEach-Object {
            Remove-AppxProvisionedPackage -Online -PackageName $_.PackageName -ErrorAction Stop | Out-Null
            Write-Log "Removed provisioned package $app"
        }
    }
    catch { $failed++; Write-Log "Could not remove $($app): $($_.Exception.Message)" }
}
if ($failed) { Write-Log "$failed app(s) failed to remove"; exit 1 }
Write-Log "Bloatware removal complete"
exit 0`
},
{
  id: 'uptime',
  label: 'Restart after 7+ days uptime',
  prompt: 'Restart devices that haven\u2019t rebooted in 7 days, with a 15-minute warning to the signed-in user.',
  summary: 'Flags devices up for more than 7 days and schedules a restart in 15 minutes with an on-screen warning, so pending updates can finish.',
  detection: String.raw`<#
.SYNOPSIS   Detect: uptime over 7 days
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$MaxDays = 7
try {
    $boot   = (Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime
    $uptime = (Get-Date) - $boot
    if ($uptime.TotalDays -gt $MaxDays) {
        Write-Output ("Non-compliant: up {0:N1} days (last boot {1:g})" -f $uptime.TotalDays, $boot)
        exit 1
    }
    Write-Output ("Compliant: up {0:N1} days" -f $uptime.TotalDays)
    exit 0
}
catch {
    Write-Output "Detection error: $($_.Exception.Message)"
    exit 1
}`,
  remediation: String.raw`<#
.SYNOPSIS   Remediate: restart with a 15-minute warning
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$DelaySeconds = 900
$Message = "{{districtShort}} {{deptName}}: this computer hasn't restarted in over a week. It will restart in 15 minutes. Please save your work."
$LogDir = "$env:ProgramData\{{logFolder}}\IntuneLogs"
$Log    = Join-Path $LogDir 'Restart-LongUptime.log'
function Write-Log($m) { $line = "$(Get-Date -Format s)  $m"; Write-Output $line; Add-Content -Path $Log -Value $line }

try {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    & shutdown.exe /r /t $DelaySeconds /c $Message /d p:4:1
    if ($LASTEXITCODE -eq 1190) { Write-Log "A restart is already scheduled; leaving it in place"; exit 0 }
    if ($LASTEXITCODE -ne 0)    { throw "shutdown.exe returned $LASTEXITCODE" }
    Write-Log "Restart scheduled in $($DelaySeconds / 60) minutes"
    exit 0
}
catch {
    Write-Log "Remediation failed: $($_.Exception.Message)"
    exit 1
}`
},
{
  id: 'bitlocker',
  label: 'Ensure BitLocker is on',
  prompt: 'Make sure BitLocker is on for the OS drive and the recovery key is backed up to Entra ID.',
  summary: 'Checks that the OS drive is BitLocker-protected; if not, enables it with the TPM (used space only) and escrows the recovery key to Entra ID.',
  detection: String.raw`<#
.SYNOPSIS   Detect: BitLocker protection on OS drive
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
try {
    $vol = Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop
    if ($vol.ProtectionStatus -eq 'On') {
        Write-Output "Compliant: $env:SystemDrive protected ($($vol.EncryptionMethod), $($vol.EncryptionPercentage)% encrypted)"
        exit 0
    }
    Write-Output "Non-compliant: $env:SystemDrive protection is $($vol.ProtectionStatus) ($($vol.VolumeStatus))"
    exit 1
}
catch {
    Write-Output "Detection error: $($_.Exception.Message)"
    exit 1
}`,
  remediation: String.raw`<#
.SYNOPSIS   Remediate: enable BitLocker on OS drive + escrow key to Entra ID
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$LogDir = "$env:ProgramData\{{logFolder}}\IntuneLogs"
$Log    = Join-Path $LogDir 'Enable-BitLocker.log'
function Write-Log($m) { $line = "$(Get-Date -Format s)  $m"; Write-Output $line; Add-Content -Path $Log -Value $line }

try {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    $tpm = Get-Tpm
    if (-not ($tpm.TpmPresent -and $tpm.TpmReady)) { throw "TPM not present or not ready" }

    $vol = Get-BitLockerVolume -MountPoint $env:SystemDrive
    if ($vol.VolumeStatus -eq 'FullyDecrypted') {
        Enable-BitLocker -MountPoint $env:SystemDrive -EncryptionMethod XtsAes256 -UsedSpaceOnly -TpmProtector -SkipHardwareTest -ErrorAction Stop | Out-Null
        Write-Log "BitLocker enabled with TPM protector"
    } elseif ($vol.ProtectionStatus -eq 'Off') {
        Resume-BitLocker -MountPoint $env:SystemDrive -ErrorAction Stop | Out-Null
        Write-Log "BitLocker protection resumed"
    }

    $vol = Get-BitLockerVolume -MountPoint $env:SystemDrive
    if (-not ($vol.KeyProtector | Where-Object KeyProtectorType -eq 'RecoveryPassword')) {
        Add-BitLockerKeyProtector -MountPoint $env:SystemDrive -RecoveryPasswordProtector -ErrorAction Stop | Out-Null
        $vol = Get-BitLockerVolume -MountPoint $env:SystemDrive
    }
    foreach ($kp in $vol.KeyProtector | Where-Object KeyProtectorType -eq 'RecoveryPassword') {
        BackupToAAD-BitLockerKeyProtector -MountPoint $env:SystemDrive -KeyProtectorId $kp.KeyProtectorId -ErrorAction Stop | Out-Null
        Write-Log "Recovery key $($kp.KeyProtectorId) backed up to Entra ID"
    }
    exit 0
}
catch {
    Write-Log "Remediation failed: $($_.Exception.Message)"
    exit 1
}`
},
{
  id: 'temp',
  label: 'Clean up Windows temp folder',
  prompt: 'Clean out C:\\Windows\\Temp when it grows past 1 GB, deleting files older than 7 days.',
  summary: 'Flags devices whose Windows temp folder is over 1 GB and removes files older than 7 days, skipping anything in use.',
  detection: String.raw`<#
.SYNOPSIS   Detect: Windows temp folder over 1 GB
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$Path  = "$env:SystemRoot\Temp"
$MaxGB = 1
try {
    $bytes = (Get-ChildItem -Path $Path -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $gb = [math]::Round(($bytes / 1GB), 2)
    if ($gb -gt $MaxGB) { Write-Output "Non-compliant: $Path is $gb GB"; exit 1 }
    Write-Output "Compliant: $Path is $gb GB"
    exit 0
}
catch {
    Write-Output "Detection error: $($_.Exception.Message)"
    exit 1
}`,
  remediation: String.raw`<#
.SYNOPSIS   Remediate: delete Windows temp files older than 7 days
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$Path    = "$env:SystemRoot\Temp"
$Cutoff  = (Get-Date).AddDays(-7)
$LogDir  = "$env:ProgramData\{{logFolder}}\IntuneLogs"
$Log     = Join-Path $LogDir 'Clear-WindowsTemp.log'
function Write-Log($m) { $line = "$(Get-Date -Format s)  $m"; Write-Output $line; Add-Content -Path $Log -Value $line }

try {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    $files = Get-ChildItem -Path $Path -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object LastWriteTime -lt $Cutoff
    $freed = 0; $skipped = 0
    foreach ($f in $files) {
        try { $len = $f.Length; Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop; $freed += $len }
        catch { $skipped++ }   # in use - leave it
    }
    Get-ChildItem -Path $Path -Recurse -Directory -Force -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length } -Descending |
        Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue) } |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Log ("Freed {0:N0} MB; skipped {1} file(s) in use" -f ($freed / 1MB), $skipped)
    exit 0
}
catch {
    Write-Log "Remediation failed: $($_.Exception.Message)"
    exit 1
}`
},
{
  id: 'timesync',
  label: 'Repair Windows time sync',
  prompt: 'Fix devices whose clock isn\u2019t syncing (Windows Time service stopped or source is the local CMOS clock).',
  summary: 'Detects a stopped Windows Time service or a local-clock time source, then sets the service to start automatically, points it at time.windows.com, and resyncs.',
  detection: String.raw`<#
.SYNOPSIS   Detect: Windows time sync healthy
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
try {
    $svc = Get-Service -Name W32Time -ErrorAction Stop
    if ($svc.Status -ne 'Running') { Write-Output "Non-compliant: W32Time is $($svc.Status)"; exit 1 }
    $source = (& w32tm /query /source 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $source -match 'Local CMOS Clock|Free-running') {
        Write-Output "Non-compliant: time source is '$source'"
        exit 1
    }
    Write-Output "Compliant: syncing from $source"
    exit 0
}
catch {
    Write-Output "Detection error: $($_.Exception.Message)"
    exit 1
}`,
  remediation: String.raw`<#
.SYNOPSIS   Remediate: repair Windows Time service and resync
.AUTHOR     {{author}}
.PUBLISHER  {{publisher}}
.VERSION    1.0
#>
$LogDir = "$env:ProgramData\{{logFolder}}\IntuneLogs"
$Log    = Join-Path $LogDir 'Repair-TimeSync.log'
function Write-Log($m) { $line = "$(Get-Date -Format s)  $m"; Write-Output $line; Add-Content -Path $Log -Value $line }

try {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    Set-Service -Name W32Time -StartupType Automatic -ErrorAction Stop
    if ((Get-Service W32Time).Status -ne 'Running') { Start-Service W32Time -ErrorAction Stop; Write-Log "Started W32Time" }

    # Domain-joined devices get time from the domain hierarchy; only set a manual peer for cloud-only devices
    $domainJoined = (Get-CimInstance Win32_ComputerSystem).PartOfDomain
    if (-not $domainJoined) {
        & w32tm /config /manualpeerlist:"time.windows.com,0x9" /syncfromflags:manual /update | Out-Null
        Write-Log "Configured manual peer time.windows.com"
    }
    & w32tm /resync /force | Out-Null
    Write-Log "Resync requested (exit $LASTEXITCODE). Source now: $((& w32tm /query /source | Out-String).Trim())"
    exit 0
}
catch {
    Write-Log "Remediation failed: $($_.Exception.Message)"
    exit 1
}`
}
];
