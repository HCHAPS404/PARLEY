"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { usePrefs } from "@/components/preferences";

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = usePrefs();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [persona, setPersona] = useState<"buyer" | "seller">("buyer");
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
        mode === "login" ? { email, password } : { username, email, password, persona },
      ),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? t("common.error"));
      return;
    }
    const me = await fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null));
    router.push(me?.user?.persona === "seller" ? "/seller" : "/app");
    router.refresh();
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-paper px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] [background-size:28px_28px] opacity-60" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
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

      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="group mb-10 flex flex-col items-center gap-4 text-center"
          title={t("login.backToSite")}
        >
          <Logo className="h-24 w-24 transition-transform duration-200 group-hover:scale-105" />
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight transition-colors group-hover:text-accent-strong">
              Parley
            </h1>
            <p className="mx-auto max-w-72 text-[13px] leading-snug text-ink-soft">
              {t("login.subtitle")}
            </p>
          </div>
        </Link>

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

          {mode === "register" && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["buyer", "seller"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPersona(p)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    persona === p
                      ? "border-accent bg-accent-mist/50"
                      : "border-line bg-paper hover:border-accent/40"
                  }`}
                >
                  <div className="text-[13px] font-semibold">
                    {t(`login.persona.${p}` as never)}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-4 text-ink-soft">
                    {t(`login.persona.${p}Sub` as never)}
                  </div>
                </button>
              ))}
            </div>
          )}

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
