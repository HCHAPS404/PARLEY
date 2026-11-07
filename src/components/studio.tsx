"use client";

import { useEffect, useRef } from "react";

export type StudioSource = { id: string; data: Record<string, unknown>[] };

type AgStudioGlobal = {
  createStudio: (
    el: HTMLElement,
    props: { data: { sources: StudioSource[] }; mode: string },
  ) => { destroy?: () => void };
  AgStudioLicenseManager: { setLicenseKey: (key: string) => void };
};

declare global {
  interface Window {
    agStudio?: AgStudioGlobal;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadStudioScript() {
  return (scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.agStudio) return resolve();
    const s = document.createElement("script");
    s.src = "/vendor/ag-studio.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("ag-studio script failed to load"));
    document.head.appendChild(s);
  }));
}

export function Studio({ sources }: { sources: StudioSource[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let api: { destroy?: () => void } | undefined;
    let cancelled = false;
    loadStudioScript()
      .then(() => {
        if (cancelled || !ref.current || !window.agStudio) return;
        const key = process.env.NEXT_PUBLIC_AG_GRID_LICENSE;
        if (key) window.agStudio.AgStudioLicenseManager.setLicenseKey(key);
        api = window.agStudio.createStudio(ref.current, {
          data: { sources },
          mode: "edit",
        });
      })
      .catch(console.error);
    return () => {
      cancelled = true;
      api?.destroy?.();
    };
    // Data sources are loaded once per page render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="h-full w-full" />;
}
