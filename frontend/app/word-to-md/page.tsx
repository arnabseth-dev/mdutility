"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";

type ConvertResponse = { markdown: string };

/**
 * Word -> MD page
 * - Full-width minimal-height upload / drag-drop area on top
 * - Below: rendered Markdown preview
 *
 * Notes:
 * - Expects POST http://localhost:8000/api/convert/word-to-md which returns { markdown: string }.
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

      const resp = await fetch("http://localhost:8000/api/convert/word-to-md", {
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

      // Sanitize / normalize any non-standard HTML tags that may come from the converter
      // e.g. <information> is not a valid custom element (must contain a hyphen),
      // which causes React/DOM errors. Replace with <div class="information">.
      const sanitizeHtmlTags = (md: string) => {
        if (!md) return md;
        return md
          .replace(/<\s*information(\b[^>]*)?>/gi, '<div class="information">')
          .replace(/<\s*\/\s*information\s*>/gi, '</div>');
      };

      setMarkdown(sanitizeHtmlTags(data.markdown));
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
    <div className="min-h-screen bg-gradient-to-b from-[#071833] via-[#0b2a4b] to-[#061b35] text-gray-100 p-6 flex flex-col">
      <div className="w-full flex-1 flex flex-col">
        {/* Back navigation to landing page */}
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center text-sm text-gray-300 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="none" stroke="currentColor">
              <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>
        {/* Top: Upload / Drop area */}
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
        <section className="mt-8 bg-white/5 border border-white/6 rounded-xl p-6 min-h-[280px] overflow-auto flex-1">
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                components={{
                  h1: ({ node, children, ...props }: any) => (
                    <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mt-6 mb-2 pb-3 border-b border-gray-700" {...props}>
                      {children}
                    </h1>
                  ),
                  h2: ({ node, children, ...props }: any) => (
                    <h2 className="text-3xl md:text-4xl font-semibold text-cyan-200 mt-5 mb-3 pl-3 border-l-4 border-cyan-600" {...props}>
                      {children}
                    </h2>
                  ),
                  h3: ({ node, children, ...props }: any) => (
                    <h3 className="text-xl font-semibold text-gray-100 mt-4 mb-1" {...props}>
                      {children}
                    </h3>
                  ),
                  small: ({ node, children, ...props }: any) => (
                    <div className="text-sm text-gray-400 mt-1" {...props}>
                      {children}
                    </div>
                  ),
                  h4: ({ node, ...props }) => <h4 className="text-lg font-medium mt-3 mb-1" {...props} />,
                  p: ({ node, ...props }) => <p className="leading-7 text-gray-200 mb-2" {...props} />,
                  a: ({ node, ...props }) => <a className="text-cyan-300 underline" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-1" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-1" {...props} />,
                  li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-gray-600 pl-4 italic text-gray-300 bg-white/2 p-3 rounded-md" {...props} />
                  ),
                  hr: () => <hr className="my-6 border-gray-700" />,
                  img: ({ node, ...props }) => <img className="max-w-full rounded-md" alt={props.alt} {...props} />,
                  table: ({ node, ...props }) => (
                    <div className="overflow-auto my-4">
                      <table className="min-w-full divide-y divide-gray-700 table-auto" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => <thead className="bg-gray-800 text-gray-100" {...props} />,
                  tbody: ({ node, ...props }) => <tbody className="bg-transparent divide-y divide-gray-700" {...props} />,
                  tr: ({ node, ...props }) => <tr {...props} />,
                  th: ({ node, ...props }) => (
                    <th className="px-3 py-2 text-left text-sm font-semibold text-gray-200 bg-gray-900" {...props} />
                  ),
                  td: ({ node, ...props }) => <td className="px-3 py-2 text-sm text-gray-300" {...props} />,
                  code: (props: any) => {
                    const { inline, className, children, ...rest } = props;
                    if (inline) {
                      return (
                        <code className="bg-gray-800 px-1 py-0.5 rounded text-sm" {...rest}>
                          {children}
                        </code>
                      );
                    }

                    return (
                      <pre className="bg-gray-900 rounded-lg p-4 overflow-auto text-sm">
                        <code className={className ?? ""} {...rest}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                }}
              >
                {markdown}
              </ReactMarkdown>
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

      {/* Fixed download button - appears when markdown is available */}
      {markdown && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <button
              onClick={() => {
                try {
                  const nameBase = fileName ? fileName.replace(/\.[^.]+$/, "") : "converted";
                  const filename = `${nameBase}.md`;
                  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  console.error("Download failed", err);
                }
              }}
              aria-label="Download converted markdown file"
              className="px-5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg hover:cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="inline-block w-5 h-5 mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M21 21H3" />
              </svg>
              <span>Download File</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
