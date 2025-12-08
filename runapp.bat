@echo off
SETLOCAL EnableDelayedExpansion

:: ==============================
:: CONFIGURATION
:: ==============================
:: Next.js Default Port is 3000.
set FRONTEND_PORT=3000
:: COMMAND FOR PYTHON BACKEND (Fixed for backend/app/main.py)
set BACKEND_CMD=uvicorn app.main:app
:: This variable is no longer strictly used, but kept for clarity
set BUILD_FOLDER=build

echo ==========================================
echo      STARTING FULL STACK APPLICATION...
echo ==========================================

:: ------------------------------
:: 1. BACKEND SETUP (Python)
:: ------------------------------
echo [1/6] Setting up Backend Environment...
cd backend

:: Create venv if it doesn't exist
if not exist .utility (
    echo       Creating .utility environment...
    python -m venv .utility
)

:: Activate Environment in the current script window
call .utility\Scripts\activate

:: Install Requirements
echo [2/6] Installing Python Dependencies...
pip install -r requirements.txt

:: Start Backend in a NEW separate window
echo [3/6] Starting Backend Server (uvicorn %BACKEND_CMD%)...
:: This command explicitly CDs into 'backend', activates the venv, and runs Uvicorn.
start "Backend Server" cmd /k "cd backend & .utility\Scripts\activate & %BACKEND_CMD%"

:: Go back to root
cd ..

:: ------------------------------
:: 2. FRONTEND SETUP (Next.js)
:: ------------------------------
echo [4/6] Setting up Frontend...
cd frontend

:: Install Node Modules
echo       Installing NPM packages...
call npm install

:: Build the project (Creates the .next folder)
echo [5/6] Building Next.js for Production...
call npm run build

:: ------------------------------
:: 3. SERVE & LAUNCH
:: ------------------------------
echo [6/6] Launching Frontend and Browser...

:: START NEXT.JS PRODUCTION SERVER (uses npm start)
start "Frontend Server" cmd /k "npm start -- -p %FRONTEND_PORT%"

:: Wait 5 seconds to let servers spin up
timeout /t 5 /nobreak >nul

:: Open Default Browser
start http://localhost:%FRONTEND_PORT%

echo.
echo ==========================================
echo      APP RUNNING!
echo      Close the popup server windows to stop the processes.
echo ==========================================
pause