# Watcher Restart Checklist

## Local watcher
1. Check whether a watcher is already running:
   - `Get-Content .watcher.lock`
2. If the PID still exists, stop it:
   - `Stop-Process -Id <pid>`
3. If only the lock file remains, remove it:
   - `Remove-Item .watcher.lock -Force`
4. Confirm local watcher env if Slack alerts matter:
   - `Get-Content .watcher.env`
5. Start the watcher:
   - `powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1`

## What you should see
- If Slack is configured:
  - watcher starts normally
- If Slack is not configured:
  - watcher prints a startup warning and still records alerts to `dispatch/alerts/`

## Cowork watcher
1. Check lock:
   - `Get-Content .cowork_watcher.lock`
2. Stop stale PID if needed:
   - `Stop-Process -Id <pid>`
3. Remove stale lock if needed:
   - `Remove-Item .cowork_watcher.lock -Force`
4. Start:
   - `powershell -ExecutionPolicy Bypass -File scripts/run_cowork_watcher.ps1`
