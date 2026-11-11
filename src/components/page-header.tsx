"use client";

import type { ReactNode } from "react";
import { usePrefs } from "@/components/preferences";
import type { I18nKey } from "@/lib/i18n";

/** Translated page header — pages are server components, so i18n lives here. */
export function PageHeader({
  title,
  sub,
  action,
}: {
  title: I18nKey;
  sub: I18nKey;
  action?: ReactNode;
}) {
  const { t } = usePrefs();
  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-3">
      <div>
        <h1 className="font-display text-lg font-semibold">{t(title)}</h1>
        <p className="text-xs text-ink-soft">{t(sub)}</p>
      </div>
      {action}
    </header>
  );
}
