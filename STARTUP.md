# Startup and prerequisites

This project provides two convenience scripts to start the backend and frontend locally:

- `Start_application.ps1` — PowerShell script (Windows, or mac/linux with PowerShell Core)
- `start-application.sh` — Bash script for macOS / Linux

Both scripts perform these steps:

1. Create a Python virtual environment at `backend/.utility` (if missing)
2. Install Python dependencies from `backend/requirements.txt` into the venv
3. Run `npm install` and `npm run build` for the frontend (using `npm`, or `pnpm`/`yarn` if present)
4. Start the backend (uvicorn) and wait for `/health` to respond
5. Start the frontend production server
6. Open `http://localhost:3000` in your default browser

Prerequisites (recommended)

- Python 3.10+ (install from https://www.python.org/) — make sure `python` or `python3` is on PATH. On Windows, the `py` launcher is supported.
- Node.js (LTS) & npm (https://nodejs.org/) — optionally `pnpm` or `yarn` if you prefer.
- Internet access to download dependencies from PyPI / npm registry.
- (Optional) PowerShell Core (`pwsh`) to run the PowerShell script on macOS / Linux.

How to run

Windows (PowerShell):

```powershell
# run once from repository root
.\Start_application.ps1

# if execution policy blocks the script, run temporarily with:
powershell -ExecutionPolicy Bypass -File .\Start_application.ps1
```

macOS / Linux (bash):

```bash
# make script executable (first run only)
chmod +x ./start-application.sh
# run
./start-application.sh
```

Troubleshooting

- If `python`/`python3` isn't found: install Python and ensure it's on PATH.
- If `npm` isn't found: install Node.js and npm.
- If the frontend or backend port is already used, stop the occupying process or change the configuration.
- The scripts write logs into `backend.log` and `frontend.log` in the repository root.

Alternative: Docker

For fully reproducible environments, consider adding a `docker-compose.yml` to run the backend and frontend in containers. I can add a basic Docker Compose setup if you'd like.
