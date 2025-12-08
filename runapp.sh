#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# ==============================
# CONFIGURATION
# ==============================
# Next.js Default Port is 3000.
FRONTEND_PORT=3000
# COMMAND FOR PYTHON BACKEND (Fixed for backend/app/main.py)
BACKEND_CMD="uvicorn app.main:app"

echo "=========================================="
echo "      STARTING FULL STACK APPLICATION..."
echo "=========================================="

# --- Function to run the backend server in the background ---
start_backend() {
    # 1. Ensure CWD is 'backend' for VENV activation and imports
    cd backend
    
    # 2. Activate VENV (source is the Unix equivalent of call)
    source .utility/bin/activate
    
    # 3. Run the Backend Server in the background (&) and ensure it doesn't leave orphan processes when terminated (trap)
    echo "Starting Backend Server (${BACKEND_CMD})..."
    
    # Run the Uvicorn command in the background
    ( $BACKEND_CMD & ) &
    
    # Get the Process ID (PID) of the last background command (uvicorn)
    BACKEND_PID=$!
    
    # Set a trap to ensure the backend process is killed when the main script exits
    trap "kill $BACKEND_PID" EXIT
    
    # Go back to the root directory
    cd ..
}

# ------------------------------
# 1. BACKEND SETUP (Python)
# ------------------------------
echo "[1/6] Setting up Backend Environment..."
cd backend

# Create venv if it doesn't exist
if [ ! -d ".utility" ]; then
    echo "      Creating .utility environment..."
    python3 -m venv .utility
fi

# Activate Environment in the current script window
source .utility/bin/activate

# Install Requirements
echo "[2/6] Installing Python Dependencies..."
pip install -r requirements.txt

# Start Backend Server (runs the start_backend function in the background)
start_backend

# Go back to root
cd ..

# ------------------------------
# 2. FRONTEND SETUP (Next.js)
# ------------------------------
echo "[4/6] Setting up Frontend..."
cd frontend

# Install Node Modules
echo "      Installing NPM packages..."
npm install

# Build the project (Creates the .next folder)
echo "[5/6] Building Next.js for Production..."
npm run build

# ------------------------------
# 3. SERVE & LAUNCH
# ------------------------------
echo "[6/6] Launching Frontend and Browser..."

# START NEXT.JS PRODUCTION SERVER in the background
npm start -- -p "$FRONTEND_PORT" &

# Get the Process ID (PID) of the frontend server
FRONTEND_PID=$!

# Set a trap to ensure the frontend process is killed when the main script exits
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT

# Wait 5 seconds to let servers spin up
echo "Waiting 5 seconds for servers to start..."
sleep 5

# Open Default Browser (using 'open' on macOS or 'xdg-open' on Linux)
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:${FRONTEND_PORT}"
elif command -v open >/dev/null 2>&1; then
    open "http://localhost:${FRONTEND_PORT}"
else
    echo "Could not find 'open' or 'xdg-open' command. Please open the URL manually."
fi

# Go back to root
cd ..

echo ""
echo "=========================================="
echo "      APP RUNNING!"
echo "      The servers are running in the background."
echo "      Press [Ctrl+C] to stop all processes."
echo "=========================================="

# Keep the main script alive so the background processes don't terminate immediately
# Ctrl+C will trigger the trap and kill the servers.
wait