<#
Start_application.ps1

Performs local startup:
- Creates a Python venv named `.utility` inside `backend` (if missing)
- Installs Python requirements into that venv
- Runs `npm install` and `npm run build` in `frontend`
- Starts the backend via the venv Python (uvicorn)
- Starts the frontend by running `npm run start`
- Opens the frontend URL in the default browser

Run from repository root in PowerShell:
    .\Start_application.ps1

#>

Set-StrictMode -Version Latest

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$venvDir = Join-Path $backendDir '.utility'
$venvPython = Join-Path $venvDir 'Scripts\python.exe'

Write-Host "Working directory: $root"

# 1) Ensure Python available
try {
    $pythonCmd = Get-Command python -ErrorAction Stop
} catch {
    Write-Error "Python not found on PATH. Install Python 3.10+ and ensure 'python' is on PATH."
    exit 1
}

# 2) Create venv if missing
if (-not (Test-Path $venvDir)) {
    Write-Host "Creating virtual environment at $venvDir"
    & python -m venv $venvDir
} else {
    Write-Host "Virtual environment already exists at $venvDir"
}

# 3) Upgrade pip and install backend requirements
if (-not (Test-Path $venvPython)) {
    Write-Error "Expected venv python not found at $venvPython"
    exit 1
}

Write-Host "Upgrading pip in venv..."
& $venvPython -m pip install --upgrade pip setuptools wheel

$reqFile = Join-Path $backendDir 'requirements.txt'
if (Test-Path $reqFile) {
    Write-Host "Installing Python requirements from $reqFile"
    & $venvPython -m pip install -r $reqFile
} else {
    Write-Warning "No requirements.txt found at $reqFile — skipping Python dependency install"
}

# 4) Install frontend node modules
if (-not (Test-Path $frontendDir)) {
    Write-Warning "Frontend folder not found at $frontendDir — skipping frontend steps"
} else {
    Write-Host "Installing frontend npm dependencies..."
    Push-Location $frontendDir
    # prefer npm; if not available, try pnpm or yarn
    try {
        Get-Command npm -ErrorAction Stop | Out-Null
        & npm install
    } catch {
        Write-Error "npm not found. Install Node.js and npm, or run the frontend install manually."
        Pop-Location
        exit 1
    }

    Write-Host "Building frontend for production..."
    & npm run build
    Pop-Location
}

# 5) Start backend server (uvicorn) in a new window
Write-Host "Starting backend server..."
$backendStartArgs = @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000')
Start-Process -FilePath $venvPython -ArgumentList $backendStartArgs -WorkingDirectory $backendDir -NoNewWindow:$false

# 6) Start frontend server (production) in a new window
if (Test-Path $frontendDir) {
    Write-Host "Starting frontend (production) server..."
    Start-Process -FilePath 'npm' -ArgumentList 'run', 'start' -WorkingDirectory $frontendDir -NoNewWindow:$false
} else {
    Write-Warning "Frontend folder not found; skipping start"
}

# 7) Open frontend URL
$frontendUrl = 'http://localhost:3000'
Write-Host "Opening frontend URL: $frontendUrl"
Start-Sleep -Seconds 2
Start-Process $frontendUrl

Write-Host "All done. Backend => http://localhost:8000 | Frontend => $frontendUrl"
