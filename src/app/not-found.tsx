"use client";

import Link from "next/link";
import { Logo } from "@/components/brand";
import { usePrefs } from "@/components/preferences";

export default function NotFound() {
  const { t } = usePrefs();
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="text-center">
        <Logo className="mx-auto h-10 w-10 opacity-60" />
        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
          {t("nf.title")}
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft">{t("nf.sub")}</p>
        <Link
          href="/app"
          className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-strong"
        >
          {t("nf.back")}
        </Link>
      </div>
    </div>
  );
}
