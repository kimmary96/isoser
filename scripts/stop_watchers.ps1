$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$repoRootLower = $repoRoot.ToLowerInvariant()
$currentPid = $PID

$processMarkers = @(
    "scripts\supervise_watcher.ps1",
    "scripts\run_watcher.ps1",
    "scripts\run_cowork_watcher.ps1",
    " watcher.py",
    " cowork_watcher.py"
)

function Test-IsRepoWatcherProcess {
    param([object]$Process)

    if (-not $Process.CommandLine -or $Process.ProcessId -eq $currentPid) {
        return $false
    }

    $commandLine = $Process.CommandLine.ToLowerInvariant()
    if (-not $commandLine.Contains($repoRootLower)) {
        return $false
    }

    foreach ($marker in $processMarkers) {
        if ($commandLine.Contains($marker.ToLowerInvariant())) {
            return $true
        }
    }

    return $false
}

function Remove-StaleLock {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        Write-Host "Lock missing: $Path"
        return
    }

    $lockPid = $null
    foreach ($line in Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue) {
        if ($line -match "^pid=(\d+)$") {
            $lockPid = [int]$matches[1]
            break
        }
    }

    if (-not $lockPid -or -not (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) {
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        Write-Host "Removed stale lock: $Path"
        return
    }

    Write-Host "Lock still active: $Path pid=$lockPid"
}

$watcherProcesses = @(
    Get-CimInstance Win32_Process |
        Where-Object { Test-IsRepoWatcherProcess -Process $_ } |
        Sort-Object ParentProcessId, ProcessId -Descending
)

if ($watcherProcesses.Count -eq 0) {
    Write-Host "No repo watcher processes found."
}
else {
    foreach ($process in $watcherProcesses) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped $($process.Name) pid=$($process.ProcessId)"
    }

    Start-Sleep -Seconds 1
}

Remove-StaleLock -Path (Join-Path $repoRoot ".watcher.lock")
Remove-StaleLock -Path (Join-Path $repoRoot ".cowork_watcher.lock")
