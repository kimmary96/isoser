param(
    [Parameter(Mandatory = $true)]
    [string]$WatcherName,

    [Parameter(Mandatory = $true)]
    [string]$RunScriptPath,

    [Parameter(Mandatory = $true)]
    [string]$LockPath,

    [Parameter(Mandatory = $true)]
    [string]$CombinedLogPath,

    [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Continue"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

function Append-LogLine {
    param([string]$Message)

    $maxAttempts = 5
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $stream = [System.IO.File]::Open($CombinedLogPath, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
            try {
                $writer = [System.IO.StreamWriter]::new($stream, $utf8NoBom)
                try {
                    $writer.WriteLine($Message)
                    $writer.Flush()
                }
                finally {
                    $writer.Dispose()
                }
            }
            finally {
                $stream.Dispose()
            }
            return
        }
        catch {
            if ($attempt -eq $maxAttempts) {
                throw
            }
            Start-Sleep -Milliseconds (50 * $attempt)
        }
    }
}

function Write-SupervisorLog {
    param([string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
    $line = "[${timestamp}] [$WatcherName] $Message"
    Append-LogLine $line
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

$logDir = Split-Path -Parent $CombinedLogPath
if ($logDir) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

Write-SupervisorLog "Supervisor started. run_script=$RunScriptPath lock=$LockPath"
$lastObservedLiveLockPid = $null

while ($true) {
    $lockPid = Get-LockPid -Path $LockPath
    if ($lockPid -and (Test-ProcessAlive -ProcessId $lockPid)) {
        if ($lastObservedLiveLockPid -ne $lockPid) {
            Write-SupervisorLog "Watcher already active with live lock pid=$lockPid. Skipping launch and rechecking soon."
            $lastObservedLiveLockPid = $lockPid
        }
        Start-Sleep -Seconds 2
        continue
    }

    $lastObservedLiveLockPid = $null
    Write-SupervisorLog "Launching watcher process."
    $LASTEXITCODE = 0

    try {
        & $RunScriptPath 2>&1 | ForEach-Object {
            $_.ToString()
        } | ForEach-Object {
            Append-LogLine $_
        }
        $exitCode = $LASTEXITCODE
    }
    catch {
        $exitCode = 1
        Write-SupervisorLog "PowerShell launcher exception: $($_.Exception.Message)"
        ($_ | Out-String).TrimEnd("`r", "`n").Split([Environment]::NewLine) | ForEach-Object {
            if ($_ -ne "") {
                Append-LogLine $_
            }
        }
    }

    $lockPid = Get-LockPid -Path $LockPath
    if ($lockPid -and (Test-ProcessAlive -ProcessId $lockPid)) {
        if ($lastObservedLiveLockPid -ne $lockPid) {
            Write-SupervisorLog "Run script returned but live lock pid=$lockPid still exists. Waiting before next check."
            $lastObservedLiveLockPid = $lockPid
        }
        Start-Sleep -Seconds 2
        continue
    }

    $lastObservedLiveLockPid = $null
    Write-SupervisorLog "Watcher exited. exit_code=$exitCode restart_in=${RestartDelaySeconds}s"
    Start-Sleep -Seconds $RestartDelaySeconds
}
