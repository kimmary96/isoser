$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$pwshExe = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $pwshExe) {
    $pwshExe = "powershell"
}

function Get-LockPid {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue) {
        if ($line -match "^pid=(\d+)$") {
            return [int]$matches[1]
        }
    }

    return $null
}

function Test-ProcessAlive {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return $false
    }

    return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Start-SupervisedWatcher {
    param(
        [string]$WatcherName,
        [string]$RunScript,
        [string]$LockFile,
        [string]$LogFile
    )

    $lockPid = Get-LockPid -Path $LockFile
    if ($lockPid -and (Test-ProcessAlive -ProcessId $lockPid)) {
        Write-Host "[$WatcherName] already running with pid=$lockPid"
        return
    }

    if (Test-Path $LockFile) {
        Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
    }

    $supervisorScript = Join-Path $scriptDir "supervise_watcher.ps1"
    $arguments = @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $supervisorScript,
        "-WatcherName",
        $WatcherName,
        "-RunScriptPath",
        $RunScript,
        "-LockPath",
        $LockFile,
        "-CombinedLogPath",
        $LogFile
    )

    Start-Process -FilePath $pwshExe -ArgumentList $arguments -WorkingDirectory $repoRoot | Out-Null
    Write-Host "[$WatcherName] supervisor started. log=$LogFile"
}

$localLogDir = Join-Path $repoRoot "dispatch\logs"
$coworkLogDir = Join-Path $repoRoot "cowork\dispatch\logs"
New-Item -ItemType Directory -Force -Path $localLogDir, $coworkLogDir | Out-Null

Start-SupervisedWatcher `
    -WatcherName "watcher" `
    -RunScript (Join-Path $scriptDir "run_watcher.ps1") `
    -LockFile (Join-Path $repoRoot ".watcher.lock") `
    -LogFile (Join-Path $localLogDir "watcher-supervisor.log")

Start-SupervisedWatcher `
    -WatcherName "cowork_watcher" `
    -RunScript (Join-Path $scriptDir "run_cowork_watcher.ps1") `
    -LockFile (Join-Path $repoRoot ".cowork_watcher.lock") `
    -LogFile (Join-Path $coworkLogDir "cowork-watcher-supervisor.log")
