"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { usePrefs } from "@/components/preferences";

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = usePrefs();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "login" ? { email, password } : { username, email, password },
      ),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? t("common.error"));
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      {/* Language quick-switch — visible before login too */}
      <div className="fixed right-4 top-4 flex rounded-md border border-line bg-card p-0.5 text-[11px] font-medium">
        {(["en", "es"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded px-2 py-1 uppercase transition-colors ${
              lang === l
                ? "bg-accent-mist text-accent-strong"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-10 w-10 text-accent" />
          <h1 className="font-display mt-4 text-xl font-semibold tracking-tight">
            Parley
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">{t("login.subtitle")}</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-line bg-card p-6 shadow-sm"
        >
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-paper p-1 text-[13px]">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-md py-1.5 font-medium capitalize transition-colors ${
                  mode === m
                    ? "bg-card text-ink shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {m === "login" ? t("login.signIn") : t("login.createAccount")}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <label className="mb-3 block text-[12px] font-medium text-ink-soft">
              {t("login.username")}
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                placeholder="your name"
              />
            </label>
          )}

          <label className="mb-3 block text-[12px] font-medium text-ink-soft">
            {t("login.email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </label>

          <label className="mb-4 block text-[12px] font-medium text-ink-soft">
            {t("login.password")}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : 1}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
              placeholder={mode === "register" ? "min. 8 characters" : "••••••••"}
            />
          </label>

          {error && (
            <div className="mb-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[12px] text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy
              ? t("login.working")
              : mode === "login"
                ? t("login.signIn")
                : t("login.createAccount")}
          </button>

          {mode === "register" && (
            <p className="mt-3 text-center text-[11px] leading-4 text-ink-soft">
              {t("login.demoNote")}
            </p>
          )}
        </form>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-ink-soft">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          {t("sidebar.escrow")} · {t("sidebar.audit").toLowerCase()}
        </div>
      </div>
    </div>
  );
}
