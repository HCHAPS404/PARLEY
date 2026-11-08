"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Eye,
  FileText,
  Handshake,
  Lock,
  LogIn,
  Moon,
  PackageSearch,
  Radio,
  ShieldCheck,
  Sun,
  Timer,
  User,
} from "lucide-react";
import { Logo } from "./brand";
import { usePrefs } from "./preferences";
import type { I18nKey } from "@/lib/i18n";

export function Landing({ authed }: { authed: boolean }) {
  const { t, lang, setLang, theme, setTheme } = usePrefs();
  const router = useRouter();
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      typeof document !== "undefined" &&
      document.documentElement.dataset.theme === "dark");

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7 text-accent" />
            <span className="font-display text-[15px] font-semibold tracking-tight">
              Parley
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-[13px] text-ink-soft md:flex">
            <a href="#how" className="transition-colors hover:text-ink">
              {t("land.nav.product")}
            </a>
            <a href="#security" className="transition-colors hover:text-ink">
              {t("land.nav.security")}
            </a>
            <a href="#stack" className="transition-colors hover:text-ink">
              {t("land.nav.stack")}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-md border border-line p-0.5 text-[10px] font-medium sm:flex">
              {(["en", "es"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
                    lang === l
                      ? "bg-accent-mist text-accent-strong"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={() => setTheme(dark ? "light" : "dark")}
              className="rounded-md border border-line p-1.5 text-ink-soft transition-colors hover:text-ink"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            {authed ? (
              <Link
                href="/app"
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong"
              >
                {t("land.nav.openApp")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink sm:flex"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {t("land.nav.signIn")}
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong"
                >
                  {t("land.nav.getStarted")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] [background-size:28px_28px] opacity-60" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-5 pb-16 pt-20 text-center sm:pt-28">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-[11px] font-medium text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t("land.hero.kicker")}
          </div>
          <h1 className="font-display mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            {t("land.hero.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-ink-soft sm:text-[16px]">
            {t("land.hero.sub")}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push(authed ? "/app" : "/login")}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[14px] font-medium text-white shadow-sm transition-all hover:bg-accent-strong hover:shadow-md"
            >
              {authed ? t("land.nav.openApp") : t("land.hero.cta")}
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#how"
              className="rounded-xl border border-line bg-card px-5 py-3 text-[14px] font-medium text-ink transition-colors hover:border-ink-soft"
            >
              {t("land.hero.ctaSecondary")}
            </a>
          </div>

          {/* Animated product demo */}
          <HeroDemo t={t} />

          {/* Stats band */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {(
              [
                ["100M+", "land.stats.products"],
                ["$0", "land.stats.capture"],
                ["15 min", "land.stats.watch"],
                ["4", "land.stats.rounds"],
              ] satisfies [string, I18nKey][]
            ).map(([v, k]) => (
              <div key={k} className="bg-card px-4 py-5 text-center">
                <div className="font-display text-2xl font-semibold tracking-tight text-accent-strong">
                  {v}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-ink-soft">
                  {t(k)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────── */}
      <section id="stack" className="border-y border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6">
          <span className="w-full text-center text-[11px] font-medium uppercase tracking-wider text-ink-soft sm:w-auto">
            {t("land.trust")}
          </span>
          {["PayPal", "Channel3", "Neon", "Modal", "Next.js", "Render"].map(
            (s) => (
              <span
                key={s}
                className="font-display text-[15px] font-semibold tracking-tight text-ink-soft/70"
              >
                {s}
              </span>
            ),
          )}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("land.how.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[14px] text-ink-soft">
          {t("land.how.sub")}
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { n: "01", icon: PackageSearch, t: "land.how.discover.t", d: "land.how.discover.d" },
              { n: "02", icon: Handshake, t: "land.how.negotiate.t", d: "land.how.negotiate.d" },
              { n: "03", icon: ShieldCheck, t: "land.how.escrow.t", d: "land.how.escrow.d" },
              { n: "04", icon: Timer, t: "land.how.watch.t", d: "land.how.watch.d" },
            ] satisfies { n: string; icon: typeof PackageSearch; t: I18nKey; d: I18nKey }[]
          ).map(({ n, icon: Icon, t: tk, d: dk }) => (
            <div
              key={tk}
              className="group rounded-2xl border border-line bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-mist text-accent-strong transition-colors group-hover:bg-accent group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-mono text-[11px] text-ink-soft/50">{n}</span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold">{t(tk)}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-ink-soft">
                {t(dk)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Security ────────────────────────────────────── */}
      <section id="security" className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("land.sec.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[14px] text-ink-soft">
            {t("land.sec.sub")}
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                { icon: Lock, t: "land.sec.policy.t", d: "land.sec.policy.d" },
                { icon: BadgeCheck, t: "land.sec.human.t", d: "land.sec.human.d" },
                { icon: Banknote, t: "land.sec.price.t", d: "land.sec.price.d" },
                { icon: FileText, t: "land.sec.audit.t", d: "land.sec.audit.d" },
                { icon: User, t: "land.sec.roles.t", d: "land.sec.roles.d" },
                { icon: Eye, t: "land.sec.watch.t", d: "land.sec.watch.d" },
              ] satisfies { icon: typeof Lock; t: I18nKey; d: I18nKey }[]
            ).map(({ icon: Icon, t: tk, d: dk }) => (
              <div
                key={tk}
                className="rounded-2xl border border-line bg-paper p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <Icon className="h-5 w-5 text-accent" />
                <h3 className="mt-3 text-[14px] font-semibold">{t(tk)}</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-ink-soft">
                  {t(dk)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Escrow explainer ────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              {t("land.split.title")}
            </h2>
            <p className="mt-4 text-[14px] leading-6 text-ink-soft">
              {t("land.split.p1")}
            </p>
            <div className="mt-6 space-y-4">
              <div className="flex gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ok-soft">
                  <BadgeCheck className="h-4 w-4 text-ok" />
                </div>
                <div>
                  <div className="text-[14px] font-medium">
                    {t("land.split.capture.t")}
                  </div>
                  <div className="text-[13px] text-ink-soft">
                    {t("land.split.capture.d")}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warn-soft">
                  <ArrowUpRight className="h-4 w-4 text-warn" />
                </div>
                <div>
                  <div className="text-[14px] font-medium">
                    {t("land.split.void.t")}
                  </div>
                  <div className="text-[13px] text-ink-soft">
                    {t("land.split.void.d")}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-6 flex items-center gap-2 rounded-lg border border-line bg-card px-3.5 py-2.5 text-[12px] text-ink-soft">
              <Radio className="h-3.5 w-3.5 text-accent" />
              {t("land.split.note")}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <div className="space-y-3 font-mono text-[12px]">
              {[
                ["POST /v2/checkout/orders", "intent: AUTHORIZE", "text-ink-soft"],
                ["approve → /api/paypal/return", "human clicks once", "text-ink-soft"],
                ["auth 99074219TC511781D", "hold: $142.00", "text-accent-strong"],
                ["watchdog tick · 15m", "expiry tracked", "text-ink-soft"],
                ["capture 7GB47706K88417005", "COMPLETED", "text-ok"],
              ].map(([a, b, c], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-line/70 bg-paper px-3.5 py-2.5"
                >
                  <span className="text-ink">{a}</span>
                  <span className={c}>{b}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-soft">
              <BarChart3 className="h-3.5 w-3.5 text-accent" />
              audited · reconcile-able · dispute-ready
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center">
          <Logo className="h-8 w-8 text-accent" />
          <div className="font-display text-[15px] font-semibold">
            {t("land.footer.built")}
          </div>
          <p className="text-[12px] text-ink-soft">{t("land.footer.tagline")}</p>
          <div className="flex items-center gap-4 text-[12px] text-ink-soft">
            <Link href="/login" className="transition-colors hover:text-ink">
              {t("land.nav.signIn")}
            </Link>
            <a
              href="https://github.com/HCHAPS404/PARLEY"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-ink"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Self-playing product demo — the agent's whole loop in ~7 seconds. */
function HeroDemo({ t }: { t: (key: I18nKey) => string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timings = [900, 1600, 1600, 1700, 4200];
    if (step >= timings.length) {
      const reset = setTimeout(() => setStep(0), 500);
      return () => clearTimeout(reset);
    }
    const id = setTimeout(() => setStep((s) => s + 1), timings[step]);
    return () => clearTimeout(id);
  }, [step]);

  const enter = "transition-all duration-500 ease-out";
  const show = (n: number) =>
    step >= n
      ? `${enter} opacity-100 translate-y-0`
      : `${enter} pointer-events-none absolute opacity-0 translate-y-3`;

  return (
    <div className="mx-auto mt-14 max-w-2xl">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
        {t("land.hero.escrowCaption")}
      </p>
      <div className="relative rounded-2xl border border-line bg-card p-5 text-left shadow-lg shadow-ink/5">
        {/* user message */}
        <div className={step >= 0 ? `${enter} opacity-100` : "opacity-0"}>
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-[13px] text-paper">
              {t("land.demo.user")}
            </div>
          </div>
        </div>

        {/* search result */}
        <div className={`${show(1)} mt-4`}>
          <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-card">
                <PackageSearch className="h-5 w-5 text-ink-soft" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">
                  Audio-Technica AT2020 — Cardioid Condenser
                </div>
                <div className="text-[11px] text-ink-soft">
                  {t("land.demo.search")}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-display text-[15px] font-semibold text-accent-strong">
                  $149.00
                </span>
                <span className="rounded-full bg-ok-soft px-1.5 py-px text-[10px] font-medium text-ok">
                  92
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* negotiation */}
        <div className={`${show(2)} mt-4 space-y-2`}>
          <div className="flex justify-end">
            <div className="rounded-xl bg-accent-mist px-3 py-2 text-[12px] text-accent-strong">
              <span className="mr-1.5 text-[9px] font-semibold uppercase tracking-wide opacity-60">
                Parley
              </span>
              {t("land.demo.neg1")}
            </div>
          </div>
          <div className="flex justify-start">
            <div className="rounded-xl bg-paper px-3 py-2 text-[12px] text-ink">
              <span className="mr-1.5 text-[9px] font-semibold uppercase tracking-wide opacity-60">
                Merchant
              </span>
              {t("land.demo.neg2")}
              <span className="ml-2 rounded-full bg-ok-soft px-1.5 py-px text-[10px] font-medium text-ok">
                {t("land.demo.agreed")}
              </span>
            </div>
          </div>
        </div>

        {/* escrow card */}
        <div className={`${show(3)} mt-4`}>
          <div className="rounded-xl border border-accent/30 bg-accent-mist p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[13px] font-medium text-accent-strong">
                <ShieldCheck className="h-4 w-4" />
                {t("land.demo.escrow")}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors duration-500 ${
                  step >= 4 ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent-strong"
                }`}
              >
                {step >= 4 ? t("land.demo.captured") : "authorized"}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white">
                {t("land.demo.approve")}
              </span>
              <span className="font-mono text-[10px] text-ink-soft/70">
                order 9U7564522L7276832
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-[11px] text-ink-soft">
          <span>{t("land.demo.held")}</span>
          <span className="flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${step >= 4 ? "bg-ok" : "bg-warn animate-pulse"}`}
            />
            PayPal escrow
          </span>
        </div>
      </div>
    </div>
  );
}
