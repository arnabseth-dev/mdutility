# backend/app/main.py
import io
import os
import logging
import re
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

import mammoth
from markdownify import markdownify as mdify
import pdfplumber

# constants
MAX_BYTES = 3 * 1024 * 1024  # 3 MB
ALLOWED_EXT = {".docx", ".pdf"}

app = FastAPI(title="MD Utility")

# Allow requests from your Next.js frontend (adjust origin in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static (favicon etc)
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")),
    name="static",
)

logger = logging.getLogger("uvicorn.error")


@app.get("/", response_class=HTMLResponse)
async def root():
    html = """
    <html>
      <head><title>MD Utility API</title></head>
      <body>
        <h2>Welcome — FastAPI is running</h2>
        <p>Try the API docs: <a href="/docs">OpenAPI docs</a></p>
      </body>
    </html>
    """
    return HTMLResponse(content=html)


@app.get("/static/favicon.ico")
async def favicon():
    favicon_path = os.path.join(os.path.dirname(__file__), "static", "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return JSONResponse({"detail": "favicon not found"}, status_code=404)


@app.get("/health")
async def health():
    return {"status": "ok", "python_version": "3.14"}


# Simple upload echo (kept)
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    return {"filename": file.filename, "size_bytes": len(contents)}


# --- Conversion helpers ---
def _file_extension(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[1].lower()


async def _read_upload_file(upload_file: UploadFile) -> bytes:
    contents = await upload_file.read()
    return contents


def convert_docx_bytes_to_markdown(contents: bytes) -> str:
    """
    Convert docx bytes -> HTML via mammoth -> Markdown via markdownify.
    """
    with io.BytesIO(contents) as f:
        result = mammoth.convert_to_html(f)
        html = result.value or ""
    # Convert HTML to markdown; adjust options if you want different styles
    md = mdify(html, heading_style="ATX")
    # Optional simple cleanup
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def convert_pdf_bytes_to_markdown(contents: bytes) -> str:
    """
    Extract text from PDF using pdfplumber and join pages.
    Best-effort; complex PDFs may need specialized handling.
    """
    text_parts = []
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            txt = page.extract_text()
            if txt:
                text_parts.append(txt.strip())
    joined = "\n\n".join(text_parts).strip()
    joined = re.sub(r"\n{3,}", "\n\n", joined)
    return joined


# --- API endpoint for conversion ---
@app.post("/api/convert/word-to-md")
async def convert_word_to_md(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = _file_extension(filename)
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXT))}")

    contents = await _read_upload_file(file)
    size = len(contents)
    if size == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    if size > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Max allowed size is 3 MB.")

    try:
        if ext == ".docx":
            markdown = convert_docx_bytes_to_markdown(contents)
        elif ext == ".pdf":
            markdown = convert_pdf_bytes_to_markdown(contents)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        if markdown is None:
            markdown = ""

        return JSONResponse({"markdown": markdown})
    except Exception as e:
        logger.exception("Conversion failed")
        # Return a sanitized message (avoid leaking stack traces)
        raise HTTPException(status_code=500, detail="Conversion failed: " + str(e))


# --- Git Auto-Update Endpoints ---
import subprocess

@app.get("/api/update/check")
async def check_update():
    """
    Checks if the local repo is behind origin/main.
    """
    try:
        # Fetch latest changes without applying
        subprocess.run(["git", "fetch", "origin"], check=True, capture_output=True)
        
        # Check commits behind
        # git rev-list --count HEAD..origin/main
        result = subprocess.run(
            ["git", "rev-list", "--count", "HEAD..origin/main"],
            check=True,
            capture_output=True,
            text=True
        )
        count = int(result.stdout.strip())
        
        return {"update_available": count > 0, "commits_behind": count}
    except subprocess.CalledProcessError as e:
        logger.error(f"Git check failed: {e}")
        return JSONResponse({"update_available": False, "error": "Git check failed"}, status_code=500)
    except Exception as e:
        logger.exception("Update check error")
        return JSONResponse({"update_available": False, "error": str(e)}, status_code=500)


@app.post("/api/update/execute")
async def execute_update():
    """
    Execute git pull and determine if restart is needed.
    """
    try:
        # Check for modified files in backend/ or requirements.txt BEFORE pull to see what WILL change.
        # Actually diffing origin/main against HEAD for specific paths is better.
        # git diff --name-only HEAD origin/main
        diff_result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD", "origin/main"],
            check=True,
            capture_output=True,
            text=True
        )
        changed_files = diff_result.stdout.splitlines()
        
        needs_restart = any(
            f.startswith("backend/") or f == "requirements.txt" or f.endswith(".py") 
            for f in changed_files
        )

        # Pull changes
        pull_result = subprocess.run(
            ["git", "pull", "origin", "main"],
            check=True,
            capture_output=True,
            text=True
        )

        return {
            "success": True, 
            "message": "Update pulled successfully.", 
            "restart_required": needs_restart,
            "changed_files": changed_files
        }

    except subprocess.CalledProcessError as e:
        logger.error(f"Git pull failed: {e.stderr}")
        return JSONResponse(
            {"success": False, "message": "Git pull failed. Local changes might be conflicting.", "error": str(e.stderr)}, 
            status_code=500
        )
    except Exception as e:
        logger.exception("Update execution error")
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)
