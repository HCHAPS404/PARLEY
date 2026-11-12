"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-[#0d9488] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#0f766e]"
    >
      Print / Save as PDF
    </button>
  );
}
