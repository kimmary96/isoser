$taskName = "Isoser Start Watchers"

Write-Host "Scheduled task status for '$taskName'"
schtasks /Query /TN $taskName /FO LIST /V | Out-Host
