"use client";
import React, { useEffect, useState } from "react";
import ConverterCard from "./ConverterCard";
import UpdateModal from "./UpdateModal";

const API_BASE = "http://localhost:8000";

export default function LandingPage() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    const checkUpdate = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/update/check`);
        if (res.ok) {
          const data = await res.json();
          if (data.update_available) {
            setShowUpdateModal(true);
          }
        }
      } catch (error) {
        console.error("Failed to check for updates", error);
      }
    };

    // Check if we just restored from an update
    const restored = localStorage.getItem("mdutility_restore_state");
    if (restored) {
      console.log("State restored after update");
      // Clear flag
      localStorage.removeItem("mdutility_restore_state");
      // Here you would rehydrate form state if we had any substantial form state to save
    }

    checkUpdate();
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/update/execute`, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        // Save state flag before reload
        localStorage.setItem("mdutility_restore_state", "true");

        // Reload page to pick up changes (backend restart might handle itself or just reload logic)
        // If backend actually restarts the service, the next fetch might fail briefly, but reload is safest.
        window.location.reload();
      } else {
        alert("Update failed: " + data.message);
        setIsUpdating(false);
      }
    } catch (error) {
      console.error("Update execution error", error);
      alert("Update execution failed. Check console.");
      setIsUpdating(false);
    }
  };

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#071833] via-[#0b2a4b] to-[#061b35] text-gray-100 flex justify-center py-16 px-4">
      <UpdateModal
        isOpen={showUpdateModal}
        onUpdate={handleUpdate}
        onClose={() => setShowUpdateModal(false)}
        isLoading={isUpdating}
      />

      {/* Animated background: rotating conic + two blurred color blobs (clipped) */}
      <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* rotating conic, stronger opacity so it's visible */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] rounded-full animate-spin-slow"
          style={{
            transformOrigin: "50% 50%",
            /* stronger alpha so you can see it */
            background:
              "conic-gradient(from 180deg at 50% 50%, rgba(0,136,255,0.30), rgba(0,0,0,0) 40%, rgba(56,189,248,0.12) 60%)",
            /* smaller blur so it's visible */
            filter: "blur(18px)",
            opacity: 0.95,
          }}
        />

        {/* soft blue blob (more visible) */}
        <div
          className="absolute -left-12 -top-12 w-72 h-72 rounded-full animate-blob animation-delay-2000"
          style={{
            background: "linear-gradient(135deg, rgba(14,165,233,0.30), rgba(3,105,161,0.16))",
            filter: "blur(28px)",
            opacity: 0.95,
          }}
        />

        {/* soft purple blob (more visible) */}
        <div
          className="absolute right-8 -bottom-20 w-80 h-80 rounded-full animate-blob animation-delay-4000"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(139,92,246,0.12))",
            filter: "blur(36px)",
            opacity: 0.95,
          }}
        />
      </div>

      <div className="w-full max-w-6xl mx-auto relative z-10">
        {/* HERO — constrained width for readability */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight tracking-tight max-w-4xl">
            From Files to Clean Markdown - And Back Again -------------------
          </h1>

          <p className="mt-4 text-lg text-gray-300 leading-relaxed max-w-12xl">
            Two simple tools to streamline documentation workflows. Convert Word/PDF files to tidy Markdown, or take Markdown and export it back to fully formatted Word documents - all in a few clicks. The converters preserve headings, lists, tables and code blocks where possible.
          </p>
        </header>

        {/* TWO CARDS SIDE-BY-SIDE */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">

          <ConverterCard
            title="Word/PDF to MD Converter"
            description="Upload or drag and drop your document to convert it into lightweight Markdown, making it easier for AI models to process while sharply reducing token usage and cost."
            icon={"/ms-word-svgrepo-com.svg"}
            accentClass="from-indigo-600 to-cyan-400"
            ctaHref="/word-to-md"
          />

          <ConverterCard
            title="MD to Word Converter"
            description="Upload or drag and drop your Markdown to generate a structured Word document shaped by your theme file, giving you a clean, branded layout ready to use or share."
            icon={"/file-md-svgrepo-com.svg"}
            accentClass="from-amber-600 to-rose-500"
            ctaHref="/"
          />

        </section>

        <p className="mt-8 text-sm text-gray-400 text-center max-w-3xl mx-auto">
          No sign-up required. Files processed securely in your browser or on the server you choose.
        </p>
      </div>
    </main>
  );
}
