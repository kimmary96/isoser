$taskName = "Isoser Start Watchers"

Write-Host "Removing scheduled task '$taskName'"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop | Out-Host
