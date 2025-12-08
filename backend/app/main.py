# project-root/backend/app/main.py
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="MD Utility")

# Allow requests from your Next.js frontend (adjust origin if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount a folder named "static" so you can serve images, favicon, CSS, etc.
# Put your favicon at: project-root/backend/app/static/favicon.ico
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

@app.get("/", response_class=HTMLResponse)
async def root():
    # Simple home page with link to interactive docs
    html = """
    <html>
      <head><title>My Utility API</title></head>
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

# Keep your upload route if you need it
from fastapi import UploadFile, File
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    return {"filename": file.filename, "size_bytes": len(contents)}
