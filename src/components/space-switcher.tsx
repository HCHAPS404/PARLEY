"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Layers, Plus } from "lucide-react";
import { usePrefs } from "./preferences";

export type SpaceInfo = { id: string; name: string; color: string };

export const SPACE_COLORS: Record<string, string> = {
  teal: "#0d9488",
  blue: "#2563eb",
  violet: "#7c3aed",
  amber: "#d97706",
  rose: "#e11d48",
  green: "#16a34a",
};

export function SpaceDot({ color, className = "h-2.5 w-2.5" }: { color: string; className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ background: SPACE_COLORS[color] ?? SPACE_COLORS.teal }}
    />
  );
}

export function SpaceSwitcher() {
  const { t } = usePrefs();
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/spaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSpaces(d.spaces);
        setActiveId(d.activeId);
      });
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const active = spaces.find((s) => s.id === activeId);

  const switchTo = async (id: string) => {
    if (id === activeId) return setOpen(false);
    await fetch("/api/spaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setActiveId(id);
    setOpen(false);
    router.refresh();
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const r = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!r.ok) return;
    const { space } = await r.json();
    setSpaces((s) => [...s, space]);
    setName("");
    setCreating(false);
    await switchTo(space.id);
  };

  return (
    <div ref={ref} className="relative border-b border-line p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-paper px-3 py-2 text-left transition-colors hover:border-accent/40"
      >
        <SpaceDot color={active?.color ?? "teal"} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {active?.name ?? "…"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-card shadow-lg shadow-ink/10">
          <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
            {t("space.switch")}
          </div>
          {spaces.map((s) => (
            <button
              key={s.id}
              onClick={() => switchTo(s.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-paper"
            >
              <SpaceDot color={s.color} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {s.id === activeId && (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent-strong" />
              )}
            </button>
          ))}
          <div className="border-t border-line/60 p-2">
            {creating ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") create();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder={t("space.namePlaceholder")}
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1.5 text-[12px] outline-none focus:border-accent"
                />
                <button
                  onClick={create}
                  disabled={!name.trim()}
                  className="rounded-md bg-accent px-2 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
                >
                  {t("space.create")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] font-medium text-accent-strong transition-colors hover:bg-accent-mist"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("space.new")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SpacesIcon() {
  return <Layers className="h-4 w-4" />;
}
