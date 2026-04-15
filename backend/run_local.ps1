Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = Join-Path $backendDir ".venv310\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Error "Python 3.10 venv not found: $pythonExe`nCreate it first with: py -3.10 -m venv backend/.venv310"
}

Push-Location $backendDir
try {
    Write-Host "[backend] using: $pythonExe"
    & $pythonExe -m pip show fastapi | Out-Null
    & $pythonExe -m uvicorn main:app --host 127.0.0.1 --port 8000
}
finally {
    Pop-Location
}
