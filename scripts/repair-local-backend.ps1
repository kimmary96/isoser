param(
  [int[]]$Ports = @(8000, 8001),
  [int]$PreferredPort = 8000,
  [switch]$Fix,
  [switch]$StartFresh,
  [switch]$Json
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot "backend"
$pythonPath = Join-Path $backendRoot "venv/Scripts/python.exe"

function Normalize-Text {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }
  return $Value.Replace("/", "\").ToLowerInvariant()
}

function Get-BackendProbe {
  param([int]$Port)

  $targets = @(
    "http://127.0.0.1:$Port/health",
    "http://127.0.0.1:$Port/programs/list?limit=1"
  )

  $results = @()
  foreach ($target in $targets) {
    try {
      $response = Invoke-WebRequest -Uri $target -UseBasicParsing -TimeoutSec 8
      $body = [string]$response.Content
      $signature = if ($body -like "*Supabase is not configured*") { "supabase_not_configured" } else { "ok" }
      $results += [pscustomobject]@{
        url = $target
        status_code = [int]$response.StatusCode
        signature = $signature
        body = $body
      }
    } catch {
      $statusCode = $null
      $body = ""
      if ($_.Exception.Response) {
        try {
          $statusCode = [int]$_.Exception.Response.StatusCode.value__
          $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
          $body = $reader.ReadToEnd()
          $reader.Dispose()
        } catch {
          $body = [string]$_.Exception.Message
        }
      } else {
        $body = [string]$_.Exception.Message
      }
      $signature = if ($body -like "*Supabase is not configured*") { "supabase_not_configured" } else { "error" }
      $results += [pscustomobject]@{
        url = $target
        status_code = $statusCode
        signature = $signature
        body = $body
      }
    }
  }

  return $results
}

function Get-BackendListeners {
  param([int[]]$PortsToInspect)

  $backendRootNormalized = Normalize-Text $backendRoot
  $repoRootNormalized = Normalize-Text $repoRoot
  $pythonPathNormalized = Normalize-Text $pythonPath
  $statuses = @()

  foreach ($port in $PortsToInspect) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    if (-not $listeners) {
      $statuses += [pscustomobject]@{
        port = $port
        pid = $null
        process_name = $null
        executable_path = $null
        command_line = $null
        is_workspace_backend = $false
        stale_reason = @()
        probe = @()
      }
      continue
    }

    foreach ($listener in ($listeners | Sort-Object -Property OwningProcess -Unique)) {
      $processId = [int]$listener.OwningProcess
      $processInfo = $null
      try {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
      } catch {
        $processInfo = $null
      }

      $commandLine = [string]($processInfo.CommandLine)
      $executablePath = [string]($processInfo.ExecutablePath)
      $processName = [string]($processInfo.Name)
      $commandLineNormalized = Normalize-Text $commandLine
      $executablePathNormalized = Normalize-Text $executablePath
      $isWorkspaceBackend = $false

      if (
        ($commandLineNormalized.Contains($backendRootNormalized) -or $commandLineNormalized.Contains($repoRootNormalized) -or $commandLineNormalized.Contains("main:app") -or $commandLineNormalized.Contains("backend.main:app")) -and
        ($processName -match "python|uvicorn" -or $executablePathNormalized.Contains($pythonPathNormalized))
      ) {
        $isWorkspaceBackend = $true
      }

      $probe = @(Get-BackendProbe -Port $port)
      $staleReasons = @()
      if (-not $processInfo) {
        $staleReasons += "owner_process_missing"
      }
      if ($isWorkspaceBackend -and ($probe | Where-Object { $_.signature -eq "supabase_not_configured" })) {
        $staleReasons += "supabase_not_configured_signature"
      }
      if ($isWorkspaceBackend -and ($probe | Where-Object { $_.signature -eq "error" -and $_.status_code -ge 500 })) {
        $staleReasons += "workspace_backend_5xx_probe"
      }

        $statuses += [pscustomobject]@{
        port = $port
        pid = $processId
        process_name = $processName
        executable_path = $executablePath
        command_line = $commandLine
        is_workspace_backend = $isWorkspaceBackend
        stale_reason = $staleReasons
        probe = $probe
      }
    }
  }

  return $statuses
}

$statuses = @(Get-BackendListeners -PortsToInspect $Ports)
$healthyPorts = @(
  $statuses |
    Where-Object {
      $_.is_workspace_backend -and
      ($_.probe | Where-Object { $_.signature -eq "ok" -and $_.status_code -eq 200 })
    } |
    Select-Object -ExpandProperty port -Unique
)

$killed = @()
if ($Fix) {
  foreach ($status in $statuses) {
    if (-not $status.pid) {
      continue
    }
    $hasStaleSignature = @($status.stale_reason).Count -gt 0
    $hasProbeFailure = @(
      $status.probe |
        Where-Object {
          $_.signature -eq "supabase_not_configured" -or
          ($_.signature -eq "error" -and $_.status_code -ge 500)
        }
    ).Count -gt 0
    $isOwnerMissingStale = ($status.stale_reason -contains "owner_process_missing") -and $hasProbeFailure
    $isWorkspaceStale = $status.is_workspace_backend -and $hasStaleSignature
    $shouldKill = ($isWorkspaceStale -or $isOwnerMissingStale) -and ($healthyPorts.Count -gt 0 -or $status.port -ne $PreferredPort -or $isOwnerMissingStale)
    if (-not $shouldKill) {
      continue
    }
    try {
      Stop-Process -Id $status.pid -Force -ErrorAction Stop
      $killed += [pscustomobject]@{
        port = $status.port
        pid = $status.pid
        reason = ($status.stale_reason -join ",")
      }
    } catch {
      $taskkillOutput = ""
      try {
        $taskkillOutput = & taskkill /PID $status.pid /F 2>&1 | Out-String
        $killed += [pscustomobject]@{
          port = $status.port
          pid = $status.pid
          reason = "taskkill_fallback: $($taskkillOutput.Trim())"
        }
      } catch {
        $killed += [pscustomobject]@{
          port = $status.port
          pid = $status.pid
          reason = "kill_failed: $($_.Exception.Message)"
        }
      }
    }
  }
}

$started = $null
if ($StartFresh) {
  if (-not (Test-Path $pythonPath)) {
    throw "Canonical backend python not found: $pythonPath"
  }
  $latestStatuses = @(Get-BackendListeners -PortsToInspect @($PreferredPort))
  $hasHealthyPreferred = $latestStatuses | Where-Object {
    $_.is_workspace_backend -and
    ($_.probe | Where-Object { $_.signature -eq "ok" -and $_.status_code -eq 200 })
  }
  if (-not $hasHealthyPreferred) {
    $process = Start-Process -FilePath $pythonPath -ArgumentList @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "$PreferredPort") -WorkingDirectory $backendRoot -PassThru
    $started = [pscustomobject]@{
      port = $PreferredPort
      pid = $process.Id
      command = "$pythonPath -m uvicorn main:app --host 127.0.0.1 --port $PreferredPort"
    }
  }
}

$report = [pscustomobject]@{
  repo_root = $repoRoot
  backend_root = $backendRoot
  preferred_port = $PreferredPort
  inspected_ports = $Ports
  healthy_ports = $healthyPorts
  killed = $killed
  started = $started
  statuses = $statuses
}

if ($Json) {
  $report | ConvertTo-Json -Depth 6
  exit 0
}

$report
