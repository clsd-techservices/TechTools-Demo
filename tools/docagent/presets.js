/*
 * Documentation Agent - ready-made examples
 * -------------------------------------------------------------
 * Used by demo mode (and as one-click examples in the kit). Each example has the
 * input a tech would type and the finished document the agent returns.
 * {{tokens}} are filled from kit-config.js, so author, publisher and log paths
 * match the district.
 *
 * Copyright (c) 2026 Scott Boyer, Systems Coordinator, CLSD Technology Services. MIT License (see LICENSE).
 */
window.DOCAGENT_PRESETS = [
{
  id: 'win32-chrome',
  label: 'Win32 app entry from rough notes',
  mode: 'notes',
  docType: 'Reference',
  category: 'Win32 Apps',
  title: 'Google Chrome Enterprise: Win32 App Entry',
  input: `chrome enterprise 64-bit msi from chromeenterprise.google
install: msiexec /i GoogleChromeStandaloneEnterprise64.msi /qn /norestart
product code changes every version so don't detect on msi code
detect on chrome.exe file version >= 129.0 instead
updates stay ON, intune just sets the floor
required for all student devices, available for staff in company portal
gotcha: old per-user installs in appdata break the detection + show 2 chromes
-> remediation "Remove per-user Chrome" cleans those up first
supersedes the old Chrome 118 app (uninstall previous = no, msi upgrades in place)`,
  context: 'Audience: other techs on the team. This goes in the knowledge repository under Win32 Apps.',
  summary: 'Turned nine lines of shorthand into a repository entry: install command, detection rule, assignments, supersedence and the per-user install gotcha.',
  markdown: `# Google Chrome Enterprise: Win32 App Entry

| | |
|---|---|
| **Department** | {{publisher}} |
| **Document type** | Reference |
| **Author** | {{author}} |
| **Version** | 1.0 (Draft) |

## Executive Summary
Google Chrome Enterprise is deployed as a Win32 app so Intune controls the minimum version without fighting Chrome's own updater. Detection checks the version of \`chrome.exe\` rather than the MSI product code, because the product code changes with every release. A paired remediation removes old per-user installs, which otherwise break detection.

## Package
| Setting | Value |
|---|---|
| Source | GoogleChromeStandaloneEnterprise64.msi (chromeenterprise.google) |
| Install command | \`msiexec /i GoogleChromeStandaloneEnterprise64.msi /qn /norestart\` |
| Uninstall command | \`msiexec /x {PRODUCT-CODE} /qn\` (read from the MSI at packaging time) |
| Install behavior | System |
| Device restart | No specific action |
| Return codes | 0 success, 3010 soft reboot, 1641 hard reboot |

## Detection Rule
1. Rule type: **File**
2. Path: \`C:\\Program Files\\Google\\Chrome\\Application\`
3. File: \`chrome.exe\`
4. Detection method: **String (version)**, operator **Greater than or equal to**, value \`129.0\`

> Why not the MSI product code? It changes on every Chrome release, so a product-code rule reports "not installed" the day after Chrome updates itself.

## Assignments
| Group | Intent |
|---|---|
| All student devices | Required |
| All staff devices | Available (Company Portal) |

## Updates and Supersedence
- Chrome's built-in updater stays **on**. Intune only sets the minimum version.
- This app supersedes **Chrome 118**. "Uninstall previous version" is **No**, because the MSI upgrades in place.

## Notes and Caveats
- **Per-user installs:** copies under \`%LOCALAPPDATA%\\Google\\Chrome\` show up as a second Chrome and can make detection fail. Assign the **Remove per-user Chrome** remediation to the same groups before this app.
- Raise the minimum version here when a security release needs to be forced. Don't create a new app for it.

## References
- Intune: Add, assign, and monitor a Win32 app (learn.microsoft.com)
- Related entry: Remediations, Remove per-user Chrome
- Packaged with the Win32 App Builder in this kit`
},
{
  id: 'script-restart',
  label: 'Document a remediation script',
  mode: 'script',
  docType: 'Script Doc',
  category: 'Remediations',
  title: 'Overdue Restart: Detection & Remediation',
  input: `# Detect
$limit = 7
$boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
$days = [math]::Round(((Get-Date) - $boot).TotalDays, 1)
if ($days -gt $limit) { Write-Output "Uptime $days days (limit $limit)"; exit 1 }
Write-Output "Uptime $days days"; exit 0

# Remediate
$msg = "Your computer will restart in 15 minutes to finish installing updates. Save your work."
msg * /time:900 $msg
shutdown.exe /r /t 900 /c "Restart scheduled by {{publisher}}" /d p:0:0
Write-Output "Restart scheduled in 15 minutes"; exit 0`,
  context: 'Generated earlier today with the Remediation Generator. Runs daily at 1 AM on student laptops. Students never restart, so updates pile up.',
  summary: 'Documented a detection and remediation pair: what each script checks, the exit codes, the user experience, the schedule, and how to roll it back.',
  markdown: `# Overdue Restart: Detection & Remediation

| | |
|---|---|
| **Department** | {{publisher}} |
| **Document type** | Script Doc |
| **Author** | {{author}} |
| **Version** | 1.0 (Draft) |

## Executive Summary
Student laptops are rarely restarted, so Windows updates install but never finish. This Intune remediation finds any device that has been up for more than 7 days and schedules a restart with a 15-minute warning. It runs daily at 1 AM as System on student devices.

## How It Works
| Script | Checks / Does | Exit codes |
|---|---|---|
| Detection | Reads \`LastBootUpTime\` and compares uptime with a 7-day limit | 0 = compliant, 1 = restart needed |
| Remediation | Shows a 15-minute warning, then schedules \`shutdown.exe /r /t 900\` | 0 = restart scheduled |

## Detection Script
\`\`\`powershell
$limit = 7
$boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
$days = [math]::Round(((Get-Date) - $boot).TotalDays, 1)
if ($days -gt $limit) { Write-Output "Uptime $days days (limit $limit)"; exit 1 }
Write-Output "Uptime $days days"; exit 0
\`\`\`

## Remediation Script
\`\`\`powershell
$msg = "Your computer will restart in 15 minutes to finish installing updates. Save your work."
msg * /time:900 $msg
shutdown.exe /r /t 900 /c "Restart scheduled by {{publisher}}" /d p:0:0
Write-Output "Restart scheduled in 15 minutes"; exit 0
\`\`\`

## Intune Settings
| Setting | Value |
|---|---|
| Run as | System |
| 64-bit PowerShell | Yes |
| Schedule | Daily, 1:00 AM |
| Assigned to | Student devices |

## What the User Sees
1. A pop-up warning that the computer will restart in 15 minutes.
2. The Windows "You're about to be signed out" notice before the restart.
3. A normal restart. Nothing else is required of the student.

## Notes and Caveats
- To change the limit, edit \`$limit\` in the detection script. The remediation doesn't need to change.
- A user can cancel with \`shutdown /a\`. Detection catches the device again the next day.
- Avoid assigning to staff devices during the school day.

## Rollback
1. Intune > Devices > Remediations > select the package.
2. Remove the student device assignment, or set the schedule to **Once**.
3. Restarts already scheduled can be cancelled on the device with \`shutdown /a\`.

## References
- Intune: Use Remediations (learn.microsoft.com)
- Generated with the Remediation Generator in this kit`
},
{
  id: 'runbook-autopilot',
  label: 'Runbook: new device shipment',
  mode: 'runbook',
  docType: 'Runbook',
  category: 'Autopilot',
  title: 'New Device Shipment: Autopilot Import',
  input: 'Importing a new shipment of laptops into Windows Autopilot with the right group tag, and confirming they are ready before they go out to buildings.',
  context: 'Every time a shipment arrives (usually summer and January). Done by a tech with the Intune Administrator role. Uses the Autopilot Import & Check tool. Vendor emails the hardware hash CSV.',
  summary: 'Built a runbook with prerequisites, numbered steps, verification, rollback and an import-error table.',
  markdown: `# New Device Shipment: Autopilot Import

| | |
|---|---|
| **Department** | {{publisher}} |
| **Document type** | Runbook |
| **Author** | {{author}} |
| **Frequency** | Each shipment (usually summer and January) |

## Executive Summary
This runbook covers getting a new laptop shipment into Windows Autopilot with the correct group tag, then confirming every device is ready before it leaves the tech office. Following it means devices arrive at buildings ready for a clean out-of-box setup, with no re-imaging.

## Prerequisites
- Intune Administrator role (or Policy and Profile Manager)
- The vendor's hardware hash CSV for the shipment
- The group tag for the device type, e.g. \`{{groupTagFirst}}\`
- The Autopilot Import & Check tool

## Procedure
1. Save the vendor CSV and open **Autopilot Import & Check**.
2. Drop the CSV on the **Import** tab. Review the rows the tool skips (missing serial, damaged hash, duplicates).
3. Set the **group tag** for the whole batch.
4. Select **Import** and wait for every row to reach **Complete**. Throttling (429) is retried automatically.
5. Wait 15 minutes for profile assignment to catch up.
6. Switch to **Readiness Check**, paste the serial list and run it.

## Verification
| Score | Meaning | Action |
|---|---|---|
| 90+ | Ready | Release to the building |
| 65 to 89 | Mostly ready | Usually waiting on profile assignment. Re-check in 15 minutes |
| Under 65 | Needs attention | Check the group tag and dynamic group membership |

## Rollback
1. Intune > Devices > Enrollment > Windows Autopilot > Devices.
2. Filter by the group tag, select the batch, and choose **Delete**.
3. Correct the CSV or the tag and re-import.

## Troubleshooting
| Error | Fix |
|---|---|
| ZtdDeviceAlreadyAssigned | Already in the tenant. Nothing to do. |
| ZtdDeviceAssignedToOtherTenant | Ask the vendor to deregister it. |
| ZtdDeviceBadHardwareHash | Re-collect the hash on the device. |

## Notes and Caveats
- Keep the vendor CSV with the purchase order. It's the only record of what was in the shipment.
- Never hand out a device that scores under 65.

## References
- Autopilot Guide in this kit
- Windows Autopilot: Manually register devices (learn.microsoft.com)`
}
];

/* Entries already in the repository when the demo starts, so the audience can watch it grow. */
window.DOCAGENT_REPO_SEED = [
  { title: 'Adobe Acrobat Reader: Win32 App Entry', category: 'Win32 Apps', docType: 'Reference', daysAgo: 21 },
  { title: 'Zoom Workplace: Win32 App Entry', category: 'Win32 Apps', docType: 'Reference', daysAgo: 14 },
  { title: 'Audio Driver Repair After Re-image', category: 'Remediations', docType: 'Script Doc', daysAgo: 12 },
  { title: 'Stale Wi-Fi Profile Cleanup', category: 'Remediations', docType: 'Script Doc', daysAgo: 6 },
  { title: 'ADE Token Renewal', category: 'iPad', docType: 'Runbook', daysAgo: 30 },
  { title: '802.1X for Devices That Never Touch the Network', category: 'Edge Cases', docType: 'Troubleshooting', daysAgo: 4 }
];
