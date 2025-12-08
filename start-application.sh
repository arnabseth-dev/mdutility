#!/usr/bin/env bash
set -euo pipefail

# start-application.sh
# Cross-platform (mac/linux) startup script to mirror Start_application.ps1 behavior
# - creates venv at backend/.utility
# - installs python requirements
# - runs npm install & build in frontend
# - starts backend (uvicorn) in background
# - starts frontend (production) in background
# - opens the frontend URL

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.utility"

echo "Working directory: $ROOT_DIR"

# find python
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON_CMD=python
else
  echo "Python not found. Install Python 3.10+ and ensure 'python3' or 'python' is on PATH." >&2
  exit 1
fi

echo "Using Python: $($PYTHON_CMD)"

# create venv
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtualenv at $VENV_DIR"
  "$PYTHON_CMD" -m venv "$VENV_DIR"
else
  echo "Virtualenv exists at $VENV_DIR"
fi

VENV_PY="$VENV_DIR/bin/python"

if [ ! -x "$VENV_PY" ]; then
  echo "Virtualenv python not found at $VENV_PY" >&2
  exit 1
fi

# upgrade pip and install requirements
"$VENV_PY" -m pip install --upgrade pip setuptools wheel
REQ_FILE="$BACKEND_DIR/requirements.txt"
if [ -f "$REQ_FILE" ]; then
  echo "Installing Python requirements"
  "$VENV_PY" -m pip install -r "$REQ_FILE"
else
  echo "requirements.txt not found, skipping Python dependency install"
fi

# detect package manager
PKG_MGR=""
if command -v npm >/dev/null 2>&1; then
  PKG_MGR=npm
elif command -v pnpm >/dev/null 2>&1; then
  PKG_MGR=pnpm
elif command -v yarn >/dev/null 2>&1; then
  PKG_MGR=yarn
fi

if [ -z "$PKG_MGR" ]; then
  echo "No package manager found (npm/pnpm/yarn). Skipping frontend steps." >&2
else
  if [ -d "$FRONTEND_DIR" ]; then
    echo "Installing frontend dependencies with $PKG_MGR"
    pushd "$FRONTEND_DIR" >/dev/null
    case "$PKG_MGR" in
      npm) npm install ;; 
      pnpm) pnpm install ;; 
      yarn) yarn install ;; 
    esac
    echo "Building frontend"
    case "$PKG_MGR" in
      npm) npm run build ;; 
      pnpm) pnpm run build ;; 
      yarn) yarn build ;; 
    esac
    popd >/dev/null
  else
    echo "Frontend folder not found, skipping frontend steps"
  fi
fi

# start backend
echo "Starting backend (uvicorn) in background"
"$VENV_PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > "$ROOT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# wait for health
HEALTH_URL="http://127.0.0.1:8000/health"
TIMEOUT=60
START=$(date +%s)
while true; do
  if curl -sSf "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Backend healthy"
    break
  fi
  NOW=$(date +%s)
  if [ $((NOW-START)) -ge $TIMEOUT ]; then
    echo "Backend did not become healthy within $TIMEOUT seconds" >&2
    break
  fi
  sleep 1
done

# start frontend (production)
if [ -d "$FRONTEND_DIR" ] && [ -n "$PKG_MGR" ]; then
  echo "Starting frontend (production) in background"
  pushd "$FRONTEND_DIR" >/dev/null
  case "$PKG_MGR" in
    npm) npm run start > "$ROOT_DIR/frontend.log" 2>&1 & ;; 
    pnpm) pnpm run start > "$ROOT_DIR/frontend.log" 2>&1 & ;; 
    yarn) yarn start > "$ROOT_DIR/frontend.log" 2>&1 & ;; 
  esac
  popd >/dev/null
else
  echo "Skipping frontend start"
fi

# open browser
FRONTEND_URL="http://localhost:3000"
echo "Opening frontend URL: $FRONTEND_URL"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$FRONTEND_URL" || true
elif command -v open >/dev/null 2>&1; then
  open "$FRONTEND_URL" || true
else
  echo "Could not open browser automatically. Visit $FRONTEND_URL manually."
fi

echo "Done. Backend PID=$BACKEND_PID"
