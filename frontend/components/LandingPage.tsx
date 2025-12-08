import React from "react";
import ConverterCard from "./ConverterCard";

export default function LandingPage() {
  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#071833] via-[#0b2a4b] to-[#061b35] text-gray-100 flex justify-center py-16 px-4">
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
            From Files to Clean Markdown - And Back Again
          </h1>

          <p className="mt-4 text-lg text-gray-300 leading-relaxed max-w-12xl">
            Two simple tools to streamline documentation workflows. Convert Word/PDF files to tidy Markdown, or take Markdown and export it back to fully formatted Word documents — all in a few clicks. The converters preserve headings, lists, tables and code blocks where possible.
          </p>
        </header>

        {/* TWO CARDS SIDE-BY-SIDE */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">

          <ConverterCard
            title="Word/PDF to MD Converter"
            description="Upload or drag and drop your document to convert it into lightweight Markdown, making it easier for AI models to process while sharply reducing token usage and cost."
            icon={"/ms-word-svgrepo-com.svg"}
            accentClass="from-indigo-600 to-cyan-400"
          />

          <ConverterCard
            title="MD to Word Converter"
            description="Upload or drag and drop your Markdown to generate a structured Word document shaped by your theme file, giving you a clean, branded layout ready to use or share."
            icon={"/file-md-svgrepo-com.svg"}
            accentClass="from-amber-600 to-rose-500"
          />

        </section>

        <p className="mt-8 text-sm text-gray-400 text-center max-w-3xl mx-auto">
          No sign-up required. Files processed securely in your browser or on the server you choose.
        </p>
      </div>
    </main>
  );
}
