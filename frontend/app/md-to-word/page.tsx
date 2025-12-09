"use client";

import React, { useCallback, useState, useRef } from "react";
import Link from "next/link";

type ConvertedFile = {
    filename: string;
    b64: string;
};

type ConvertResponse = {
    files: ConvertedFile[];
    zip: string | null;
};

export default function Page() {
    const [mdFiles, setMdFiles] = useState<File[]>([]);
    const [themeFile, setThemeFile] = useState<File | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ConvertResponse | null>(null);

    const mdInputRef = useRef<HTMLInputElement>(null);
    const themeInputRef = useRef<HTMLInputElement>(null);

    // Handle MD Selection
    const handleMdSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // Append new files
            const newFiles = Array.from(e.target.files);
            setMdFiles((prev) => [...prev, ...newFiles]);
        }
        // reset input using e.target directly to ensure change event fires next time especially if same file is selected
        e.target.value = "";
    };

    const removeMdFile = (index: number) => {
        setMdFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle Theme Selection
    const handleThemeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setThemeFile(e.target.files[0]);
        }
        if (themeInputRef.current) themeInputRef.current.value = "";
    };

    // Drag and Drop for MD
    const [dragActive, setDragActive] = useState(false);
    const onDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };
    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragActive) setDragActive(true);
    };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith(".md"));
            if (dropped.length > 0) {
                setMdFiles(prev => [...prev, ...dropped]);
            }
        }
    };

    // Convert
    const handleConvert = async () => {
        if (mdFiles.length === 0) {
            setError("Please upload at least one Markdown file.");
            return;
        }
        setError(null);
        setIsConverting(true);
        setResult(null);

        try {
            const formData = new FormData();
            mdFiles.forEach((f) => formData.append("files", f));
            if (themeFile) {
                formData.append("theme", themeFile);
            }

            const res = await fetch("http://localhost:8000/api/convert/md-to-word", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `Server error: ${res.status}`);
            }

            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Conversion failed");
        } finally {
            setIsConverting(false);
        }
    };

    // Download Helper
    const downloadBase64 = (b64: string, filename: string) => {
        try {
            const byteCharacters = atob(b64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Download error", e);
            alert("Failed to download file");
        }
    };

    const downloadZip = () => {
        if (!result?.zip) return;
        try {
            const byteCharacters = atob(result.zip);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "application/zip" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "converted_files.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Zip download error", e);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#071833] via-[#0b2a4b] to-[#061b35] text-gray-100 p-6 flex flex-col">
            <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col gap-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center text-sm text-gray-300 hover:text-white transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7" />
                        </svg>
                        Back to Home
                    </Link>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                        Markdown to Word Converter
                    </h1>
                </div>

                {/* Info Box */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg text-sm text-gray-300">
                    <h3 className="font-semibold text-white mb-1">Instructions</h3>
                    <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li>Upload one or more <strong>.md</strong> files.</li>
                        <li>Optionally upload a <strong>Theme file</strong> (.docx).</li>
                        <li>The theme acts as a template for styles (headers, fonts, margins).</li>
                    </ul>
                </div>

                {/* Upload MD Section */}
                <section
                    className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 flex flex-col items-center justify-center text-center group
                ${dragActive ? "border-cyan-400 bg-cyan-400/10" : "border-gray-700 bg-gray-900/30 hover:border-gray-500"}
                cursor-pointer
            `}
                    onDragEnter={onDragEnter}
                    onDragLeave={onDragLeave}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                >
                    <input
                        ref={mdInputRef}
                        type="file"
                        multiple
                        accept=".md"
                        onChange={handleMdSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="pointer-events-none">
                        <div className="mx-auto w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <p className="text-lg font-medium text-gray-200">Drag & drop Markdown files here</p>
                        <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                    </div>
                </section>

                {/* Selected Files List */}
                {mdFiles.length > 0 && (
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex justify-between">
                            <span>Selected Files ({mdFiles.length})</span>
                            <button onClick={() => setMdFiles([])} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">
                                Clear All
                            </button>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {mdFiles.map((f, i) => (
                                <div key={i} className="flex items-center justify-between bg-gray-800/50 p-2 rounded text-sm group">
                                    <span className="truncate text-gray-300">{f.name}</span>
                                    <button
                                        onClick={() => removeMdFile(i)}
                                        className="ml-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Theme Upload Section */}
                <section className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-300">Theme File (Optional)</h3>
                            <p className="text-xs text-gray-500 mt-1">Upload a .docx file to style/template the output.</p>
                            <p className="text-[10px] text-amber-400 mt-1 opacity-90">
                                Tip: Use <strong>Word Styles</strong> (e.g. Modify "Heading 1"), not direct formatting.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {themeFile ? (
                                <div className="flex items-center gap-2 bg-indigo-500/20 text-indigo-200 px-3 py-1.5 rounded-full text-sm border border-indigo-500/40">
                                    <span className="truncate max-w-[150px]">{themeFile.name}</span>
                                    <button onClick={() => setThemeFile(null)} className="hover:text-white cursor-pointer">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <span className="text-xs text-gray-500 italic">No theme selected</span>
                            )}
                            <button
                                onClick={() => themeInputRef.current?.click()}
                                className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 transition text-sm font-medium cursor-pointer"
                            >
                                Browse Theme
                            </button>
                            <a
                                href="http://localhost:8000/api/download/sample-theme"
                                download="sample_theme.docx"
                                className="px-4 py-2 rounded-md border border-gray-600 text-gray-300 hover:bg-gray-800 transition text-sm font-medium cursor-pointer flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Sample
                            </a>
                            <input
                                ref={themeInputRef}
                                type="file"
                                accept=".docx"
                                onChange={handleThemeSelect}
                                className="hidden"
                            />
                        </div>
                    </div>
                </section>

                {/* Action Button */}
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleConvert}
                        disabled={isConverting || mdFiles.length === 0}
                        className={`
                    px-8 py-3 rounded-full font-semibold text-white shadow-lg flex items-center gap-2
                    ${isConverting || mdFiles.length === 0
                                ? "bg-gray-600 cursor-not-allowed opacity-70"
                                : "bg-indigo-600 hover:bg-indigo-500 transform hover:-translate-y-0.5 transition-all cursor-pointer"
                            }
                `}
                    >
                        {isConverting ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Converting...
                            </>
                        ) : (
                            <>
                                <span>Convert to Word</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg">
                        <p>{error}</p>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Conversion Results</h2>
                            {result.files.length > 1 && result.zip && (
                                <button
                                    onClick={downloadZip}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow opacity-90 hover:opacity-100 transition cursor-pointer"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download All (ZIP)
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {result.files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-gray-800/40 p-3 rounded-lg border border-gray-700 hover:border-gray-500 transition">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-900/40 rounded text-blue-300">
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                <polyline points="10 9 9 9 8 9"></polyline>
                                            </svg>
                                        </div>
                                        <span className="font-medium text-gray-200">{file.filename}</span>
                                    </div>
                                    <button
                                        onClick={() => downloadBase64(file.b64, file.filename)}
                                        className="px-3 py-1.5 text-sm text-cyan-300 hover:text-cyan-200 hover:bg-cyan-900/20 rounded transition cursor-pointer"
                                    >
                                        Download
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
