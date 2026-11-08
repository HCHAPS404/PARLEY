"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelineTask } from "./pipeline-inner";

export function Pipeline() {
  const [mod, setMod] = useState<{
    default: (p: { tasks: PipelineTask[] }) => React.ReactElement;
  } | null>(null);
  const [tasks, setTasks] = useState<PipelineTask[] | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    // Licence must be set before any Bryntum module loads.
    const g = globalThis as { bryntum?: { licenseKey?: string } };
    (g.bryntum ??= {}).licenseKey = process.env.NEXT_PUBLIC_BRYNTUM_LICENSE;
    Promise.all([import("./pipeline-inner"), fetch("/api/pipeline-data").then((r) => r.json())])
      .then(([m, d]) => {
        setMod(m);
        setTasks(d.tasks);
      })
      .catch(console.error);
  }, []);

  if (!mod || !tasks) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-500">
        Loading order pipeline…
      </div>
    );
  }
  const Inner = mod.default;
  return <Inner tasks={tasks} />;
}
