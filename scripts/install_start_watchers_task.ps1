$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$taskName = "Isoser Start Watchers"
$pwshExe = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $pwshExe) {
    $pwshExe = "powershell.exe"
}

$startScript = Join-Path $scriptDir "start_watchers.ps1"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

Write-Host "Registering scheduled task '$taskName' for user $currentUser"
Write-Host "Execute: $pwshExe"
Write-Host "Arguments: -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""

$action = New-ScheduledTaskAction `
    -Execute $pwshExe `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -User $currentUser `
    -RunLevel Limited `
    -Force | Out-Host

Write-Host ""
Write-Host "Scheduled task registered. Current definition:"
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State, Author, Description, TaskPath | Out-Host
