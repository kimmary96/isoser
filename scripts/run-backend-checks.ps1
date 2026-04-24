param(
  [switch]$Full
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$activatePath = Join-Path $repoRoot "backend/venv/Scripts/Activate.ps1"

if (-not (Test-Path $activatePath)) {
  throw "Canonical backend venv not found: $activatePath"
}

. $activatePath
Set-Location $repoRoot

python --version
python -m py_compile backend/routers/programs.py backend/services/program_list_filters.py backend/schemas/programs.py

if ($Full) {
  python -m pytest backend/tests -q
} else {
  python -m pytest backend/tests/test_programs_router.py backend/tests/test_program_list_api_examples.py -q
}
