# backend/app/main.py
import io
import os
import logging
import re
from typing import Optional, List
import zipfile
import base64

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

import mammoth
from markdownify import markdownify as mdify
import pdfplumber
import markdown
from bs4 import BeautifulSoup
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

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


from fastapi import Response

@app.get("/api/download/sample-theme")
def download_sample_theme():
    """
    Download the sample theme file reliably (Sync read).
    """
    path = os.path.join(os.path.dirname(__file__), "static", "sample_theme.docx")
    if not os.path.exists(path):
         raise HTTPException(status_code=404, detail="Sample theme not found")
    
    with open(path, "rb") as f:
        content = f.read()

    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
        headers={"Content-Disposition": "attachment; filename=sample_theme.docx"}
    )


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


# --- MD to Word Conversion ---

def add_toc(doc):
    """
    Insert a Table of Contents (TOC) at the start of the document.
    """
    paragraph = doc.add_paragraph()
    run = paragraph.add_run()
    
    # 1. Begin Field
    fldChar = OxmlElement('w:fldChar')
    fldChar.set(qn('w:fldCharType'), 'begin')
    fldChar.set(qn('w:dirty'), 'true')
    run._r.append(fldChar)
    
    # 2. Field Instructions
    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = 'TOC \\o "1-3" \\h \\z \\u'
    run._r.append(instrText)
    
    # 3. Separate Field
    fldChar = OxmlElement('w:fldChar')
    fldChar.set(qn('w:fldCharType'), 'separate')
    run._r.append(fldChar)
    
    # 4. End Field
    fldChar = OxmlElement('w:fldChar')
    fldChar.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar)
    
    doc.add_page_break()

def force_update_fields(doc):
    """
    Inject w:updateFields into settings.xml to force Word to update TOC/fields on open.
    """
    settings = doc.settings.element
    # Check if element already exists
    update_fields = settings.find(qn('w:updateFields'))
    if update_fields is None:
        update_fields = OxmlElement('w:updateFields')
        settings.append(update_fields)
    
    update_fields.set(qn('w:val'), 'true')

def force_print_layout(doc):
    """
    Inject w:view w:val="print" into settings.xml to force Print Layout view.
    """
    settings = doc.settings.element
    view = settings.find(qn('w:view'))
    if view is None:
        view = OxmlElement('w:view')
        settings.append(view)
    view.set(qn('w:val'), 'print')   


def _add_html_to_document(doc, html_content: str):
    """
    Basic HTML to Docx parser.
    Supports headings, paragraphs, and lists.
    Forcibly applies 'Segoe UI' to maintain consistency.
    """
    soup = BeautifulSoup(html_content, "html.parser")
    
    for element in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "pre", "blockquote", "table"]):
        if element.name.startswith("h"):
            level = int(element.name[1])
            h = doc.add_heading(element.get_text(), level=level)
            # Force Segoe UI
            for run in h.runs:
                run.font.name = 'Segoe UI'
                
        elif element.name == "p":
            p = doc.add_paragraph(element.get_text())
            for run in p.runs:
                run.font.name = 'Segoe UI'
                
        elif element.name in ["ul", "ol"]:
            for li in element.find_all("li"):
                style = "List Bullet" if element.name == "ul" else "List Number"
                p = doc.add_paragraph(li.get_text(), style=style)
                for run in p.runs:
                    run.font.name = 'Segoe UI'
                    
        elif element.name == "pre":
             # Code blocks
             p = doc.add_paragraph()
             runner = p.add_run(element.get_text())
             runner.font.name = 'Courier New' # Code stays Courier
             runner.font.size = Pt(10)
             
        elif element.name == "blockquote":
            p = doc.add_paragraph(element.get_text())
            p.style = 'Quote' # or 'Intense Quote' if available, otherwise fallback
            for run in p.runs:
                run.font.name = 'Segoe UI'
        elif element.name == "table":
            # Basic table handling
            rows = element.find_all("tr")
            if not rows:
                continue
            
            # Determine max columns
            max_cols = 0
            for r in rows:
                cols = r.find_all(["td", "th"])
                max_cols = max(max_cols, len(cols))
            
            table = doc.add_table(rows=len(rows), cols=max_cols)
            table.style = 'Table Grid'
            
            for i, row in enumerate(rows):
                cells = row.find_all(["td", "th"])
                
                # Check if this is a header row (first row or <th> elements)
                is_header = (i == 0)
                
                # Apply row formatting if header
                if is_header:
                    tr = table.rows[i]._tr
                    trPr = tr.get_or_add_trPr()
                    # Cannot easily set row height/color here on row level for all cells in python-docx 
                    # efficiently without iterating cells, so handled in cell loop
                
                for j, cell in enumerate(cells):
                    if j < max_cols:
                        docx_cell = table.cell(i, j)
                        docx_cell.text = cell.get_text().strip()
                        
                        # Custom Formatting
                        # Header Row: BG #003366, Text White, Bold, Center
                        if is_header:
                            # SHADING
                            tcPr = docx_cell._tc.get_or_add_tcPr()
                            shd = OxmlElement('w:shd')
                            shd.set(qn('w:val'), 'clear')
                            shd.set(qn('w:color'), 'auto')
                            shd.set(qn('w:fill'), '003366') # Dark Blue
                            tcPr.append(shd)
                            
                            # PARAGRAPH / RUN
                            for paragraph in docx_cell.paragraphs:
                                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                                for run in paragraph.runs:
                                    run.font.bold = False # Reset then set
                                    run.font.bold = True
                                    run.font.color.rgb = RGBColor(255, 255, 255)
                                    run.font.name = 'Segoe UI'
                                    run.font.size = Pt(11)
                        else:
                            # Body Cells: Segoe UI 10.5
                            for paragraph in docx_cell.paragraphs:
                                for run in paragraph.runs:
                                    run.font.name = 'Segoe UI'
                                    run.font.size = Pt(10.5)

def _clear_document_content(doc: Document):
    """
    Remove all content from the document body, 
    but preserve the last paragraph to maintain valid XML and Section Properties.
    """
    # Delete all tables
    for tbl in doc.tables:
        tbl._element.getparent().remove(tbl._element)
        
    # Delete all paragraphs EXCEPT the last one
    if len(doc.paragraphs) > 0:
        for p in doc.paragraphs[:-1]:
            p._element.getparent().remove(p._element)
            
        # Clear the last paragraph instead of deleting it
        last_p = doc.paragraphs[-1]
        last_p.clear() 
    else:
        # Should not happen in a valid docx, but safety
        pass

def get_default_document():
    """
    Load the default 'sample_theme.docx' and clear its content
    to serve as the base template with Headers/Footers.
    """
    try:
        theme_path = os.path.join(os.path.dirname(__file__), "static", "sample_theme.docx")
        if os.path.exists(theme_path):
            doc = Document(theme_path)
            _clear_document_content(doc)
            return doc
    except Exception as e:
        print(f"Error loading default theme: {e}")
    
    return Document() # Fallback to blank if missing

def convert_md_to_docx_bytes(md_content: str, theme_bytes: Optional[bytes] = None, theme_is_docx: bool = False) -> bytes:
    doc = None
    
    if theme_is_docx and theme_bytes:
        try:
            doc = Document(io.BytesIO(theme_bytes))
            # If used as a theme, we likely want to clear its content (text) 
            # but keep the styles.
            _clear_document_content(doc)
        except Exception:
            # Fallback if corrupt
            pass
            
    # If no valid doc loaded from upload, use default theme
    if doc is None:
        doc = get_default_document()
        
        # If user uploaded a text file as theme (rare), we can prepend it
        if theme_bytes and not theme_is_docx:
            try:
                theme_text = theme_bytes.decode('utf-8', errors='ignore')
                doc.add_paragraph(theme_text)
                doc.add_page_break()
            except:
                pass

    # Convert MD to HTML
    html = markdown.markdown(md_content, extensions=['tables'])
    
    # Add TOC first
    add_toc(doc)
    
    # Force update fields on open
    force_update_fields(doc)
    
    # Force Print Layout
    force_print_layout(doc)
    
    # Add to Docx
    _add_html_to_document(doc, html)
    
    # Save to buffer
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


@app.post("/api/convert/md-to-word")
async def convert_md_to_word(
    files: List[UploadFile] = File(...),
    theme: Optional[UploadFile] = File(None)
):
    if not files:
         raise HTTPException(status_code=400, detail="No files uploaded")

    # Load theme if present
    theme_bytes = None
    theme_is_docx = False
    if theme:
        ext = _file_extension(theme.filename)
        if ext != ".docx":
            raise HTTPException(status_code=400, detail="Theme file must be a .docx document.")
        theme_bytes = await theme.read()
        theme_is_docx = True

    converted_files = []
    
    # Convert each file
    for f in files:
        content = await f.read()
        # Decode MD
        try:
            md_text = content.decode("utf-8")
        except:
            # Try latin-1 fallback?
            md_text = content.decode("latin-1", errors="ignore")
            
        docx_bytes = convert_md_to_docx_bytes(md_text, theme_bytes, theme_is_docx)
        
        # Output filename
        base_name = os.path.splitext(f.filename)[0]
        out_name = f"{base_name}.docx"
        b64 = base64.b64encode(docx_bytes).decode("utf-8")
        
        converted_files.append({
            "filename": out_name,
            "b64": b64
        })

    # If multiple files, also create a zip
    zip_b64 = None
    if len(converted_files) > 0:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for item in converted_files:
                data = base64.b64decode(item["b64"])
                zf.writestr(item["filename"], data)
        zip_b64 = base64.b64encode(zip_buffer.getvalue()).decode("utf-8")

    return JSONResponse({
        "files": converted_files,
        "zip": zip_b64
    })


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
    Also rebuilds frontend if files in frontend/ have changed.
    """
    try:
        # Check for modified files in backend/ or requirements.txt BEFORE pull to see what WILL change.
        # git diff --name-only HEAD origin/main
        diff_result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD", "origin/main"],
            check=True,
            capture_output=True,
            text=True
        )
        changed_files = diff_result.stdout.splitlines()
        
        needs_backend_restart = any(
            f.startswith("backend/") or f == "requirements.txt" or f.endswith(".py") 
            for f in changed_files
        )
        
        needs_frontend_rebuild = any(
            f.startswith("frontend/") for f in changed_files
        )

        # Pull changes
        pull_result = subprocess.run(
            ["git", "pull", "origin", "main"],
            check=True,
            capture_output=True,
            text=True
        )

        # Pip Install if needed
        if any(f == "requirements.txt" or f.endswith("requirements.txt") for f in changed_files):
            try:
                logger.info("requirements.txt changed. Running pip install...")
                # Assuming venv is active or available in path
                subprocess.run(
                    ["pip", "install", "-r", "requirements.txt"],
                    check=True,
                    capture_output=True,
                    text=True
                )
            except subprocess.CalledProcessError as e:
                logger.error(f"Pip install failed: {e.stderr}")
                # We don't abort, just log, as restart is pending anyway
        
        rebuild_msg = ""
        if needs_frontend_rebuild:
            try:
                # We assume CWD is 'backend' (as per runapp scripts), so frontend is at '../frontend'
                frontend_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "frontend"))
                
                # npm install
                subprocess.run(
                    ["npm", "install"],
                    cwd=frontend_dir,
                    check=True,
                    shell=True  # often needed for npm on windows
                )
                
                # npm run build
                subprocess.run(
                    ["npm", "run", "build"],
                    cwd=frontend_dir,
                    check=True,
                    shell=True
                )
                rebuild_msg = " Frontend rebuilt successfully."
                
                # RESTART FRONTEND SERVER (Port 3000)
                try:
                    # 1. Find PID on port 3000
                    # netstat -ano | findstr :3000
                    # TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12345
                    netstat = subprocess.run(
                        ["netstat", "-ano"], 
                        capture_output=True, 
                        text=True, 
                        shell=True
                    )
                    
                    pid_to_kill = None
                    for line in netstat.stdout.splitlines():
                        if ":3000 " in line and "LISTENING" in line:
                            parts = line.split()
                            # Last part is usually PID
                            pid = parts[-1]
                            if pid.isdigit() and pid != "0":
                                pid_to_kill = pid
                                break
                    
                    if pid_to_kill:
                        logger.info(f"Killing old frontend process PID: {pid_to_kill}")
                        subprocess.run(
                            ["taskkill", "/F", "/PID", pid_to_kill],
                            check=False,
                            shell=True
                        )
                    
                    # 2. Start new server
                    logger.info("Starting new frontend server...")
                    # Use CREATE_NEW_CONSOLE (0x10) to open a new window on Windows
                    # so the user can see it running, detached from backend.
                    CREATE_NEW_CONSOLE = 0x10
                    subprocess.Popen(
                        ["npm", "start", "--", "-p", "3000"],
                        cwd=frontend_dir,
                        shell=True,
                        creationflags=CREATE_NEW_CONSOLE
                    )
                    rebuild_msg += " Frontend server restarted."
                    
                except Exception as restart_err:
                    logger.error(f"Frontend restart failed: {restart_err}")
                    rebuild_msg += f" Restart failed: {restart_err}"

            except subprocess.CalledProcessError as e:
                logger.error(f"Frontend rebuild failed: {e}")
                rebuild_msg = " Frontend rebuild failed. Check server logs."

        return {
            "success": True, 
            "message": f"Update pulled successfully.{rebuild_msg}", 
            "restart_required": needs_backend_restart,
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
