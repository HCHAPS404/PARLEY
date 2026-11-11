"use client";

import { usePrefs } from "@/components/preferences";

export function ExportLink() {
  const { t } = usePrefs();
  return (
    <a
      href="/api/export"
      className="rounded-md border border-line px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink"
    >
      {t("hdr.exportCsv")}
    </a>
  );
}
