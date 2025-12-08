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
    Set-StrictMode -Version Latest

    $ErrorActionPreference = 'Stop'

    $root = Split-Path -Parent $MyInvocation.MyCommand.Definition
    Set-Location $root

    $backendDir = Join-Path $root 'backend'
    $frontendDir = Join-Path $root 'frontend'
    $venvDir = Join-Path $backendDir '.utility'

    Write-Host "Working directory: $root"

    # Helper: pick available python executable (python, python3, py -3)
    function Get-PythonCmd {
        $candidates = @('python', 'python3', 'py')
        foreach ($cmd in $candidates) {
            try {
                $null = Get-Command $cmd -ErrorAction Stop
                if ($cmd -eq 'py') {
                    # ensure py -3 works
                    try { & py -3 --version > $null 2>&1; return 'py -3' } catch { continue }
                }
                return $cmd
            } catch { }
        }
        return $null
    }

    $pythonCmd = Get-PythonCmd
    if (-not $pythonCmd) {
        Write-Error "Python not found on PATH. Install Python 3.10+ and ensure 'python' or 'python3' is on PATH (or 'py' on Windows)."
        exit 1
    }

    Write-Host "Using Python command: $pythonCmd"

    # Create venv if missing
    if (-not (Test-Path $venvDir)) {
        Write-Host "Creating virtual environment at $venvDir"
        & $pythonCmd -m venv $venvDir
    } else {
        Write-Host "Virtual environment already exists at $venvDir"
    }

    # Determine venv python path (cross-platform)
    $isWindows = $IsWindows -eq $true
    if ($isWindows) {
        $venvPython = Join-Path $venvDir 'Scripts\\python.exe'
    } else {
        $venvPython = Join-Path $venvDir 'bin/python'
    }

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

    # Helper: pick node package manager
    function Get-PackageManager {
        if (Get-Command npm -ErrorAction SilentlyContinue) { return 'npm' }
        if (Get-Command pnpm -ErrorAction SilentlyContinue) { return 'pnpm' }
        if (Get-Command yarn -ErrorAction SilentlyContinue) { return 'yarn' }
        return $null
    }

    $pkgMgr = Get-PackageManager
    if (-not $pkgMgr) {
        Write-Warning "No node package manager found (npm/pnpm/yarn). Frontend steps will be skipped."
    }

    # 4) Install frontend node modules and build
    if (-not (Test-Path $frontendDir)) {
        Write-Warning "Frontend folder not found at $frontendDir — skipping frontend steps"
    } elseif (-not $pkgMgr) {
        Write-Warning "No package manager available — skipping frontend install/build"
    } else {
        Write-Host "Installing frontend dependencies with $pkgMgr..."
        Push-Location $frontendDir
        switch ($pkgMgr) {
            'npm'  { & npm install }
            'pnpm' { & pnpm install }
            'yarn' { & yarn install }
        }

        Write-Host "Building frontend for production..."
        switch ($pkgMgr) {
            'npm'  { & npm run build }
            'pnpm' { & pnpm run build }
            'yarn' { & yarn build }
        }
        Pop-Location
    }

    # 5) Start backend server (uvicorn) in a new window
    Write-Host "Starting backend server..."
    $backendStartArgs = @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000')
    Start-Process -FilePath $venvPython -ArgumentList $backendStartArgs -WorkingDirectory $backendDir -NoNewWindow:$false

    # 6) Wait for backend health endpoint
    $healthUrl = 'http://127.0.0.1:8000/health'
    Write-Host "Waiting for backend health at $healthUrl (timeout 60s)..."
    $start = Get-Date
    while ((Get-Date) - $start -lt ([TimeSpan]::FromSeconds(60))) {
        try {
            $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { Write-Host "Backend healthy."; break }
        } catch { Start-Sleep -Seconds 1 }
    }

    # 7) Start frontend server (production) in a new window
    if (Test-Path $frontendDir -and $pkgMgr) {
        Write-Host "Starting frontend (production) server..."
        switch ($pkgMgr) {
            'npm'  { Start-Process -FilePath 'npm' -ArgumentList 'run', 'start' -WorkingDirectory $frontendDir -NoNewWindow:$false }
            'pnpm' { Start-Process -FilePath 'pnpm' -ArgumentList 'run', 'start' -WorkingDirectory $frontendDir -NoNewWindow:$false }
            'yarn' { Start-Process -FilePath 'yarn' -ArgumentList 'start' -WorkingDirectory $frontendDir -NoNewWindow:$false }
        }
    } else {
        Write-Warning "Skipping frontend start (missing folder or package manager)"
    }

    # 8) Open frontend URL
    $frontendUrl = 'http://localhost:3000'
    Write-Host "Opening frontend URL: $frontendUrl"
    Start-Sleep -Seconds 2
    try { Start-Process $frontendUrl } catch { Write-Warning "Could not open browser automatically." }

    Write-Host "All done. Backend => http://localhost:8000 | Frontend => $frontendUrl"
