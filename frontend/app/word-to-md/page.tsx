"use client";

import React, { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";

type ConvertResponse = { markdown: string };

/**
 * Word -> MD page
 * - Full-width minimal-height upload / drag-drop area on top
 * - Below: rendered Markdown preview
 *
 * Notes:
 * - Expects POST /api/convert/word-to-md which returns { markdown: string }.
 * - If you don't have a backend yet, the UI will show a placeholder and file name.
 */

export default function Page() {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accepted = [".docx", ".pdf"]; // only allow docx and pdf
  const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

  const handleFiles = useCallback(async (files: FileList | null) => {
    setError(null);
    setMarkdown(null);

    if (!files || files.length === 0) return;
    const f = files[0];

    // Validate extension
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!accepted.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Supported: .docx, .pdf`);
      return;
    }

    // Validate size
    if (f.size > MAX_BYTES) {
      setError("File too large. Maximum allowed size is 3 MB.");
      return;
    }

    setFileName(f.name);
    setLoading(true);

    try {
      const form = new FormData();
      form.append("file", f);

      const resp = await fetch("/api/convert/word-to-md", {
        method: "POST",
        body: form,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Server returned ${resp.status}`);
      }

      const data = (await resp.json()) as ConvertResponse;

      if (!data || typeof data.markdown !== "string") {
        throw new Error("Invalid server response (expected { markdown })");
      }

      setMarkdown(data.markdown);
    } catch (err: any) {
      setError(err?.message ?? "Conversion failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // drag handlers
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging) setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  // file input change
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openPicker = () => fileInputRef.current?.click();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071833] via-[#0b2a4b] to-[#061b35] text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Top: Upload / Drop area - full width, minimal height */}
        <section
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`w-full rounded-xl border-2 ${dragging ? "border-cyan-400/60 bg-white/3" : "border-gray-800"} p-6 flex items-center gap-6 transition-colors`}
          style={{ minHeight: 120 }}
        >
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Upload or drag & drop your Word / PDF</h2>
            <p className="text-sm text-gray-300 mt-1">
              Supported: <span className="font-medium">.docx</span>, <span className="font-medium">.pdf</span>.
              The converted Markdown will appear below.
            </p>
            <p className="text-xs text-gray-400 mt-1">Max file size: 3 MB</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              onChange={onPickFile}
              accept=".docx,.pdf"
              type="file"
              className="hidden"
            />

            <button
              onClick={openPicker}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 transition text-sm font-medium"
            >
              Choose file
            </button>

            <button
              onClick={() => {
                setFileName(null);
                setMarkdown(null);
                setError(null);
              }}
              className="px-3 py-2 rounded-md border border-gray-700 text-sm text-gray-300 hover:bg-white/2 transition"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Preview / result - full width below */}
        <section className="mt-8 bg-white/5 border border-white/6 rounded-xl p-6 min-h-[280px]">
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-t-indigo-500 border-gray-700 animate-spin" />
              <div>Converting {fileName ?? ""} — please wait...</div>
            </div>
          ) : error ? (
            <div>
              <p className="text-sm text-amber-300 font-medium">Error</p>
              <p className="mt-2 text-sm text-gray-300">{error}</p>
              <p className="mt-4 text-sm text-gray-400">
                If you don't yet have a backend route, implement POST /api/convert/word-to-md that returns <code>{`{ markdown: string }`}</code>.
              </p>
            </div>
          ) : markdown ? (
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
          ) : fileName ? (
            <div>
              <p className="text-sm text-gray-300">File selected: <span className="font-medium">{fileName}</span></p>
              <p className="mt-3 text-sm text-gray-400">No converted Markdown yet. Connect your backend to see the result.</p>
            </div>
          ) : (
            <div className="text-gray-400">
              <p className="text-sm">Preview will appear here after conversion.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
