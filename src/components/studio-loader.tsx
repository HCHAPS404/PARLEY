"use client";

import { useEffect, useState } from "react";
import { Studio, type StudioSource } from "./studio";

export function StudioLoader() {
  const [sources, setSources] = useState<StudioSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics-data")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d) => setSources(d.sources))
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-600">
        Failed to load analytics data: {error}
      </div>
    );
  }
  if (!sources) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-500">
        Loading procurement data…
      </div>
    );
  }
  return <Studio sources={sources} />;
}
