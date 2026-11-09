"use client";

import { useState } from "react";
import { Check, Search, Handshake, ShieldCheck, X } from "lucide-react";
import { usePrefs } from "./preferences";

const KEY = "parley_onboarded";

/** First-run checklist — the golden path to seeing the product work. */
export function Onboarding() {
  const { t } = usePrefs();
  const [show, setShow] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem(KEY),
  );
  if (!show) return null;
  const done = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };
  const steps = [
    { icon: Search, text: t("onb.s1") },
    { icon: Handshake, text: t("onb.s2") },
    { icon: ShieldCheck, text: t("onb.s3") },
  ];
  return (
    <div className="mx-4 mt-4 rounded-xl border border-accent/30 bg-accent-mist p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">{t("onb.title")}</h3>
        <button onClick={done} aria-label="dismiss" className="text-ink-soft hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="mt-2 space-y-1.5">
        {steps.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px] text-ink-soft">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-accent/40 text-accent">
              <Check className="h-2.5 w-2.5" />
            </span>
            <Icon className="h-3.5 w-3.5 text-accent" /> {text}
          </li>
        ))}
      </ol>
    </div>
  );
}
