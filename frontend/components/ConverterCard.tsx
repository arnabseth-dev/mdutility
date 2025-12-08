
import React from "react";

type Props = {
  title: string;
  description: string;
  icon: React.ReactNode;
  cta?: string;
  accentClass?: string;
};

export default function ConverterCard({ title, description, icon, cta = "Convert now", accentClass = "from-indigo-600 to-cyan-400" }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-white/3 to-white/2 backdrop-blur-md border border-white/6 shadow-lg transform transition hover:-translate-y-2 hover:scale-[1.01]">
      <div className="absolute inset-0 pointer-events-none">
        <span className="card-glow group-hover:opacity-100" />
      </div>

      <div className="flex items-start gap-4">
        <div
          className={`w-14 h-14 rounded-md bg-gradient-to-tr ${accentClass} flex items-center justify-center shadow-md`}
        >
          {typeof icon === "string" ? (
            <img src={icon} alt="" className="w-8 h-8" />
          ) : (
            icon
          )}
        </div>


        <div className="flex-1">
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-gray-300 mt-2 text-sm">{description}</p>
          <div className="mt-4">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium shadow hover:bg-indigo-500 transition">
              {cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
