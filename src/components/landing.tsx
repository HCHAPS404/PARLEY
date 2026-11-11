"use client";

import { useEffect, useRef, useState } from "react";
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
  Lock,
  LogIn,
  PackageSearch,
  Radar,
  Radio,
  ScanSearch,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";
import { Logo } from "./brand";
import { usePrefs } from "./preferences";
import { Reveal, useReducedMotion, useScrollProgress } from "./scroll-fx";
import type { I18nKey } from "@/lib/i18n";

/* Dark-premium landing — fixed palette, independent of app theme. */
const BG = "bg-[#060a09]";
const CARD = "bg-[#0c1210]";
const LINE = "border-white/[0.08]";
const INK = "text-[#e8efec]";
const SOFT = "text-[#8fa3a0]";
const TEAL = "text-[#2dd4bf]";

export function Landing({ authed }: { authed: boolean }) {
  const { t, lang, setLang } = usePrefs();
  const router = useRouter();
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const pageProgress = () => {
    if (typeof document === "undefined") return 0;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    return total > 0 ? Math.min(1, scrollY / total) : 0;
  };
  /* hero mockup drifts down + shrinks a touch as you scroll away */
  const reduced = useReducedMotion();
  const heroDrift = reduced ? 0 : Math.min(scrollY / 900, 1);

  return (
    <div className={`min-h-screen ${BG} ${INK}`}>
      {/* scroll progress */}
      <div
        className="fixed left-0 top-0 z-[60] h-[2px] bg-gradient-to-r from-[#0d9488] to-[#2dd4bf] transition-[width] duration-150 ease-out motion-reduce:hidden"
        style={{ width: `${pageProgress() * 100}%` }}
      />
      {/* ── Nav ─────────────────────────────────────────── */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b ${LINE} ${BG}/70 backdrop-blur-xl`}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7 text-[#2dd4bf]" />
            <span className="font-display text-[15px] font-semibold tracking-tight">
              Parley
            </span>
          </Link>
          <nav className={`hidden items-center gap-5 text-[13px] ${SOFT} md:flex`}>
            <a href="#how" className="transition-colors hover:text-white">
              {t("land.nav.product")}
            </a>
            <a href="#agents" className="transition-colors hover:text-white">
              Agents
            </a>
            <a href="#security" className="transition-colors hover:text-white">
              {t("land.nav.security")}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className={`hidden rounded-md border ${LINE} p-0.5 text-[10px] font-medium sm:flex`}>
              {(["en", "es"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
                    lang === l
                      ? "bg-[#14b8a6]/15 text-[#2dd4bf]"
                      : `${SOFT} hover:text-white`
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {authed ? (
              <Link
                href="/app"
                className="flex items-center gap-1.5 rounded-lg bg-[#14b8a6] px-3.5 py-1.5 text-[13px] font-medium text-[#04211d] transition-all hover:bg-[#2dd4bf] hover:shadow-[0_0_24px_-4px_#14b8a6]"
              >
                {t("land.nav.openApp")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ${SOFT} transition-colors hover:text-white sm:flex`}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {t("land.nav.signIn")}
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-lg bg-[#14b8a6] px-3.5 py-1.5 text-[13px] font-medium text-[#04211d] transition-all hover:bg-[#2dd4bf] hover:shadow-[0_0_24px_-4px_#14b8a6]"
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
        {/* glow field */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="pointer-events-none absolute -top-52 left-1/2 h-[30rem] w-[64rem] -translate-x-1/2 rounded-full bg-[#14b8a6]/15 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -left-40 h-80 w-80 rounded-full bg-[#14b8a6]/10 blur-[100px]" />
        <div className="pointer-events-none absolute top-40 -right-40 h-80 w-80 rounded-full bg-[#0d9488]/10 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl px-5 pb-20 pt-24 text-center sm:pt-32">
          <div className={`inline-flex items-center gap-2 rounded-full border ${LINE} ${CARD}/80 px-4 py-1.5 text-[11px] font-medium ${SOFT} backdrop-blur`}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf] shadow-[0_0_8px_#2dd4bf]" />
            {t("land.hero.kicker")}
          </div>
          <h1 className="font-display mx-auto mt-7 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            {t("land.hero.title")}
          </h1>
          <p className={`mx-auto mt-6 max-w-2xl text-[15px] leading-7 ${SOFT} sm:text-[17px]`}>
            {t("land.hero.sub")}
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push(authed ? "/app" : "/login")}
              className="flex items-center gap-2 rounded-xl bg-[#14b8a6] px-6 py-3.5 text-[14px] font-semibold text-[#04211d] shadow-[0_0_40px_-8px_#14b8a6] transition-all hover:bg-[#2dd4bf] hover:shadow-[0_0_50px_-4px_#14b8a6]"
            >
              {authed ? t("land.nav.openApp") : t("land.hero.cta")}
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#how"
              className={`rounded-xl border ${LINE} ${CARD}/60 px-6 py-3.5 text-[14px] font-medium ${INK} backdrop-blur transition-colors hover:border-white/25`}
            >
              {t("land.hero.ctaSecondary")}
            </a>
          </div>

          {/* Product mockup — animated demo inside a browser frame */}
          <div
            className="relative mx-auto mt-16 max-w-3xl will-change-transform"
            style={{
              transform: `translateY(${heroDrift * 48}px) scale(${1 - heroDrift * 0.05})`,
              opacity: 1 - heroDrift * 0.35,
            }}
          >
            <div className="pointer-events-none absolute -inset-x-8 -top-8 h-40 bg-[#14b8a6]/15 blur-[80px]" />
            <div className={`relative rounded-2xl border ${LINE} ${CARD} shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]`}>
              {/* browser chrome */}
              <div className={`flex items-center gap-3 border-b ${LINE} px-4 py-2.5`}>
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
                </div>
                <div className={`mx-auto flex items-center gap-1.5 rounded-md border ${LINE} bg-[#060a09] px-3 py-1 font-mono text-[10px] ${SOFT}`}>
                  <Lock className="h-2.5 w-2.5 text-[#2dd4bf]" />
                  parley.app/agent
                </div>
                <div className="w-12" />
              </div>
              <HeroDemo t={t} />
            </div>
          </div>

          {/* Stats band */}
          <div className={`mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border ${LINE} bg-white/[0.06] sm:grid-cols-4`}>
            {(
              [
                ["100M+", "land.stats.products"],
                ["$0", "land.stats.capture"],
                ["15 min", "land.stats.watch"],
                ["4", "land.stats.rounds"],
              ] satisfies [string, I18nKey][]
            ).map(([v, k]) => (
              <div key={k} className={`${CARD} px-4 py-6 text-center`}>
                <div className="font-display text-3xl font-semibold tracking-tight text-[#2dd4bf]">
                  {v}
                </div>
                <div className={`mt-1.5 text-[11px] leading-4 ${SOFT}`}>
                  {t(k)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────── */}
      <section id="stack" className={`border-y ${LINE} ${CARD}/40`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-7">
          <span className={`w-full text-center text-[11px] font-medium uppercase tracking-wider ${SOFT} sm:w-auto`}>
            {t("land.trust")}
          </span>
          {["PayPal", "Channel3", "Neon", "Modal", "Next.js", "Render"].map(
            (s) => (
              <span
                key={s}
                className="font-display text-[15px] font-semibold tracking-tight text-white/40 transition-colors hover:text-white/70"
              >
                {s}
              </span>
            ),
          )}
        </div>
      </section>

      {/* ── Scrollytelling: the loop ────────────────────── */}
      <ScrollStory t={t} />

      {/* ── Two agents, one protocol ────────────────────── */}
      <section id="agents" className={`border-y ${LINE} ${CARD}/40`}>
        <Reveal className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
          <div className="relative order-2 lg:order-1">
            <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[#14b8a6]/10 blur-[60px]" />
            {/* eslint-disable-next-line @next/next/no-img-element -- generated brand asset */}
            <img
              src="/gen/agents-meet.webp"
              alt={t("land.agents.imgAlt")}
              className={`relative w-full rounded-2xl border ${LINE} shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)]`}
              loading="lazy"
            />
          </div>
          <div className="order-1 lg:order-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#2dd4bf]">
              A2A protocol
            </span>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("land.agents.title")}
            </h2>
            <p className={`mt-4 text-[14px] leading-6 ${SOFT}`}>
              {t("land.agents.sub")}
            </p>
            <ul className="mt-7 space-y-4">
              {(
                ["land.agents.b1", "land.agents.b2", "land.agents.b3"] as I18nKey[]
              ).map((k) => (
                <li key={k} className="flex items-start gap-3 text-[13px]">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2dd4bf]" />
                  <span className={SOFT}>{t(k)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ── Beyond sourcing ───────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight sm:text-5xl">
          {t("land.more.title")}
        </h2>
        <p className={`mx-auto mt-4 max-w-xl text-center text-[14px] ${SOFT}`}>
          {t("land.more.sub")}
        </p>
        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { icon: BarChart3, t: "land.more.market.t", d: "land.more.market.d" },
              { icon: Radar, t: "land.more.radar.t", d: "land.more.radar.d" },
              { icon: ScanSearch, t: "land.more.visual.t", d: "land.more.visual.d" },
              { icon: Store, t: "land.more.seller.t", d: "land.more.seller.d" },
            ] satisfies { icon: typeof BarChart3; t: I18nKey; d: I18nKey }[]
          ).map(({ icon: Icon, t: tk, d: dk }) => (
            <div
              key={tk}
              className={`group rounded-2xl border ${LINE} ${CARD} p-5 transition-all hover:-translate-y-1 hover:border-[#14b8a6]/30 hover:shadow-[0_20px_40px_-20px_rgba(20,184,166,0.25)]`}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#14b8a6]/10 text-[#2dd4bf] transition-colors group-hover:bg-[#14b8a6] group-hover:text-[#04211d]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold">{t(tk)}</h3>
              <p className={`mt-1.5 text-[13px] leading-5 ${SOFT}`}>
                {t(dk)}
              </p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── Escrow explainer — asymmetric editorial ─────── */}
      <section className={`border-y ${LINE} ${CARD}/40`}>
        <Reveal className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#2dd4bf]">
                PayPal escrow
              </span>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                {t("land.split.title")}
              </h2>
            </div>
            <div>
              <p className={`text-[14px] leading-6 ${SOFT}`}>
                {t("land.split.p1")}
              </p>
              <div className="mt-6 space-y-4">
                <div className="flex gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#22c55e]/10">
                    <BadgeCheck className="h-4 w-4 text-[#4ade80]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium">
                      {t("land.split.capture.t")}
                    </div>
                    <div className={`text-[13px] ${SOFT}`}>
                      {t("land.split.capture.d")}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eab308]/10">
                    <ArrowUpRight className="h-4 w-4 text-[#facc15]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium">
                      {t("land.split.void.t")}
                    </div>
                    <div className={`text-[13px] ${SOFT}`}>
                      {t("land.split.void.d")}
                    </div>
                  </div>
                </div>
              </div>
              <p className={`mt-6 flex items-center gap-2 rounded-lg border ${LINE} ${CARD} px-3.5 py-2.5 text-[12px] ${SOFT}`}>
                <Radio className="h-3.5 w-3.5 text-[#2dd4bf]" />
                {t("land.split.note")}
              </p>
            </div>
          </div>
          <div className={`mt-12 rounded-2xl border ${LINE} ${CARD} p-6 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]`}>
            <div className="space-y-3 font-mono text-[12px] sm:text-[13px]">
              {[
                ["POST /v2/checkout/orders", "intent: AUTHORIZE", SOFT],
                ["approve → /api/paypal/return", "human clicks once", SOFT],
                ["auth 99074219TC511781D", "hold: $142.00", TEAL],
                ["watchdog tick · 15m", "expiry tracked", SOFT],
                ["capture 7GB47706K88417005", "COMPLETED", "text-[#4ade80]"],
              ].map(([a, b, c], i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg border ${LINE} bg-[#060a09] px-4 py-3`}
                >
                  <span className={INK}>{a}</span>
                  <span className={c}>{b}</span>
                </div>
              ))}
            </div>
            <div className={`mt-4 flex items-center gap-2 text-[11px] ${SOFT}`}>
              <BarChart3 className="h-3.5 w-3.5 text-[#2dd4bf]" />
              audited · reconcile-able · dispute-ready
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Who it's for — media card row ────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal className="grid gap-5 md:grid-cols-3">
          {(
            [
              { img: "/gen/hero-user.webp", t: "land.row.buyer.t", d: "land.row.buyer.d" },
              { img: "/gen/agents-meet.webp", t: "land.row.protocol.t", d: "land.row.protocol.d" },
              { img: "/gen/seller-sleep.webp", t: "land.row.seller.t", d: "land.row.seller.d" },
            ] satisfies { img: string; t: I18nKey; d: I18nKey }[]
          ).map((c) => (
            <div key={c.t} className="group">
              <div className={`overflow-hidden rounded-2xl border ${LINE}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- generated brand asset */}
                <img
                  src={c.img}
                  alt={t(c.t)}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <h3 className="mt-5 text-[16px] font-semibold leading-6">
                {t(c.t)}
              </h3>
              <p className={`mt-1.5 text-[13px] leading-5 ${SOFT}`}>
                {t(c.d)}
              </p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── Security ────────────────────────────────────── */}
      <section id="security" className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight sm:text-5xl">
          {t("land.sec.title")}
        </h2>
        <p className={`mx-auto mt-4 max-w-xl text-center text-[14px] ${SOFT}`}>
          {t("land.sec.sub")}
        </p>
        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              className={`rounded-2xl border ${LINE} ${CARD} p-5 transition-all hover:-translate-y-1 hover:border-[#14b8a6]/30`}
            >
              <Icon className="h-5 w-5 text-[#2dd4bf]" />
              <h3 className="mt-3 text-[14px] font-semibold">{t(tk)}</h3>
              <p className={`mt-1.5 text-[13px] leading-5 ${SOFT}`}>
                {t(dk)}
              </p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── Final CTA ─────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/[0.08]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#14b8a6]/10 blur-[120px]" />
        <Reveal className="relative mx-auto max-w-4xl px-5 py-28 text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            {t("land.cta.title")}
          </h2>
          <p className={`mx-auto mt-5 max-w-xl text-[15px] leading-7 ${SOFT}`}>
            {t("land.cta.sub")}
          </p>
          <div className="mt-9 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-xl bg-[#14b8a6] px-7 py-4 text-[15px] font-semibold text-[#04211d] shadow-[0_0_50px_-8px_#14b8a6] transition-all hover:bg-[#2dd4bf] hover:shadow-[0_0_60px_-4px_#14b8a6]"
            >
              {t("land.hero.cta")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className={`text-[11px] ${SOFT}`}>
              {t("land.cta.note")}
            </span>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className={`border-t ${LINE} bg-[#040707]`}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-12 text-center">
          <Logo className="h-9 w-9 text-[#2dd4bf]" />
          <div className="font-display text-[15px] font-semibold">
            {t("land.footer.built")}
          </div>
          <p className={`text-[12px] ${SOFT}`}>{t("land.footer.tagline")}</p>
          <div className={`flex items-center gap-4 text-[12px] ${SOFT}`}>
            <Link href="/login" className="transition-colors hover:text-white">
              {t("land.nav.signIn")}
            </Link>
            <a
              href="https://github.com/HCHAPS404/PARLEY"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Pinned scroll story — the screen holds while the four stages of the
   agent loop cycle underneath the scroll (Apple-keynote style). */
function ScrollStory({ t }: { t: (key: I18nKey) => string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useScrollProgress(ref);
  const reduced = useReducedMotion();

  const stages = (
    [
      { n: "01", img: "/gen/market-radar.webp", tk: "land.how.discover.t", dk: "land.how.discover.d", alt: "land.more.imgAlt" },
      { n: "02", img: "/gen/negotiation-loop.webp", tk: "land.how.negotiate.t", dk: "land.how.negotiate.d" },
      { n: "03", img: "/gen/escrow-vault.webp", tk: "land.how.escrow.t", dk: "land.how.escrow.d" },
      { n: "04", img: "/gen/dashboard-deco.webp", tk: "land.how.watch.t", dk: "land.how.watch.d" },
    ]
  ) satisfies { n: string; img: string; tk: I18nKey; dk: I18nKey; alt?: I18nKey }[];

  const idx = Math.min(stages.length - 1, Math.floor(progress * stages.length));

  /* Reduced-motion / no-JS-friendly fallback: plain stacked grid. */
  if (reduced) {
    return (
      <section id="how" className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight sm:text-5xl">
          {t("land.how.title")}
        </h2>
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {stages.map((s) => (
            <div key={s.n} className={`overflow-hidden rounded-2xl border ${LINE} ${CARD}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- generated brand asset */}
              <img src={s.img} alt="" className="h-40 w-full object-cover" />
              <div className="p-5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#2dd4bf]">{s.n}</span>
                <h3 className="mt-1 text-[15px] font-semibold">{t(s.tk)}</h3>
                <p className={`mt-1 text-[13px] leading-5 ${SOFT}`}>{t(s.dk)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="how"
      ref={ref}
      className="relative"
      style={{ height: `${stages.length * 90 + 40}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        {/* ambient glow that shifts with the stage */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#14b8a6] blur-[140px] transition-opacity duration-700"
          style={{ opacity: 0.06 + idx * 0.02 }}
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
          {/* left: stage text */}
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("land.how.title")}
              </h2>
              <span className="font-mono text-[11px] text-[#2dd4bf]">
                {stages[idx].n} / 0{stages.length}
              </span>
            </div>
            <p className={`mt-2 text-[13px] ${SOFT}`}>{t("land.how.sub")}</p>

            <div className="relative mt-8 h-44 sm:h-36">
              {stages.map((s, i) => (
                <div
                  key={s.n}
                  className={`absolute inset-0 transition-all duration-500 ease-out ${
                    i === idx
                      ? "opacity-100 translate-y-0"
                      : i < idx
                        ? "pointer-events-none opacity-0 -translate-y-6"
                        : "pointer-events-none opacity-0 translate-y-6"
                  }`}
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-[#2dd4bf]">
                    Stage {s.n}
                  </span>
                  <h3 className="font-display mt-2 text-2xl font-semibold sm:text-3xl">
                    {t(s.tk)}
                  </h3>
                  <p className={`mt-3 max-w-md text-[14px] leading-6 ${SOFT}`}>
                    {t(s.dk)}
                  </p>
                </div>
              ))}
            </div>

            {/* progress dots */}
            <div className="mt-4 flex items-center gap-2">
              {stages.map((s, i) => (
                <span
                  key={s.n}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === idx ? "w-8 bg-[#2dd4bf] shadow-[0_0_10px_#14b8a6]" : "w-1.5 bg-white/15"
                  }`}
                />
              ))}
            </div>

            {/* escrow lifecycle strip on the last stage */}
            <div
              className={`mt-6 flex items-center gap-0 font-mono text-[10px] transition-all duration-500 ${
                idx === stages.length - 1 ? "opacity-100 translate-y-0" : "pointer-events-none absolute opacity-0 translate-y-3"
              }`}
            >
              {["authorize", "hold", "deliver", "capture"].map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`rounded-lg border px-2.5 py-1.5 ${LINE} bg-[#060a09] ${i === 3 ? "text-[#2dd4bf] border-[#14b8a6]/40" : SOFT}`}>
                    {s}
                  </div>
                  {i < 3 && <div className="h-px w-4 bg-white/15" />}
                </div>
              ))}
            </div>
          </div>

          {/* right: stacked imagery */}
          <div className="relative hidden aspect-[4/3] sm:block">
            {stages.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- generated brand assets
              <img
                key={s.n}
                src={s.img}
                alt={s.alt ? t(s.alt) : t(s.tk)}
                loading={i === 0 ? "eager" : "lazy"}
                className={`absolute inset-0 h-full w-full rounded-2xl border ${LINE} object-cover shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] transition-all duration-700 ease-out ${
                  i === idx
                    ? "opacity-100 scale-100 translate-y-0"
                    : i < idx
                      ? "pointer-events-none opacity-0 scale-[0.97] -translate-y-4"
                      : "pointer-events-none opacity-0 scale-[1.04] translate-y-6"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
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
    <div className="p-5 text-left sm:p-6">
      {/* user message */}
      <div className={step >= 0 ? `${enter} opacity-100` : "opacity-0"}>
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-[13px] text-[#060a09]">
            {t("land.demo.user")}
          </div>
        </div>
      </div>

      {/* search result */}
      <div className={`${show(1)} mt-4`}>
        <div className={`rounded-xl border ${LINE} bg-[#060a09] px-3.5 py-3`}>
          <div className="flex items-center gap-3">
            <div className={`grid h-11 w-11 place-items-center rounded-lg ${CARD}`}>
              <PackageSearch className={`h-5 w-5 ${SOFT}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">
                Audio-Technica AT2020 — Cardioid Condenser
              </div>
              <div className={`text-[11px] ${SOFT}`}>
                {t("land.demo.search")}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-display text-[15px] font-semibold text-[#2dd4bf]">
                $149.00
              </span>
              <span className="rounded-full bg-[#22c55e]/15 px-1.5 py-px text-[10px] font-medium text-[#4ade80]">
                92
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* negotiation */}
      <div className={`${show(2)} mt-4 space-y-2`}>
        <div className="flex justify-end">
          <div className="rounded-xl bg-[#14b8a6]/15 px-3 py-2 text-[12px] text-[#2dd4bf]">
            <span className="mr-1.5 text-[9px] font-semibold uppercase tracking-wide opacity-60">
              Parley
            </span>
            {t("land.demo.neg1")}
          </div>
        </div>
        <div className="flex justify-start">
          <div className={`rounded-xl bg-[#060a09] border ${LINE} px-3 py-2 text-[12px] ${INK}`}>
            <span className="mr-1.5 text-[9px] font-semibold uppercase tracking-wide opacity-60">
              Merchant
            </span>
            {t("land.demo.neg2")}
            <span className="ml-2 rounded-full bg-[#22c55e]/15 px-1.5 py-px text-[10px] font-medium text-[#4ade80]">
              {t("land.demo.agreed")}
            </span>
          </div>
        </div>
      </div>

      {/* escrow card */}
      <div className={`${show(3)} mt-4`}>
        <div className="rounded-xl border border-[#14b8a6]/30 bg-[#14b8a6]/[0.07] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#2dd4bf]">
              <ShieldCheck className="h-4 w-4" />
              {t("land.demo.escrow")}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors duration-500 ${
                step >= 4 ? "bg-[#22c55e]/15 text-[#4ade80]" : "bg-[#14b8a6]/15 text-[#2dd4bf]"
              }`}
            >
              {step >= 4 ? t("land.demo.captured") : "authorized"}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#14b8a6] px-3 py-1.5 text-[12px] font-semibold text-[#04211d]">
              {t("land.demo.approve")}
            </span>
            <span className={`font-mono text-[10px] ${SOFT}`}>
              order 9U7564522L7276832
            </span>
          </div>
        </div>
      </div>

      <div className={`mt-4 flex items-center justify-between border-t ${LINE} pt-3 text-[11px] ${SOFT}`}>
        <span>{t("land.demo.held")}</span>
        <span className="flex items-center gap-1">
          <span
            className={`h-1.5 w-1.5 rounded-full ${step >= 4 ? "bg-[#4ade80]" : "bg-[#facc15] animate-pulse"}`}
          />
          PayPal escrow
        </span>
      </div>
    </div>
  );
}
