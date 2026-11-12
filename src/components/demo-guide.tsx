"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  KeyRound,
  LogIn,
  MessagesSquare,
  PackageCheck,
  Search,
  Send,
  ShieldCheck,
  Star,
  Store,
  Truck,
  User,
  Zap,
} from "lucide-react";
import { Logo } from "./brand";
import { usePrefs } from "./preferences";
import { Reveal } from "./scroll-fx";
import type { I18nKey } from "@/lib/i18n";

/* Same fixed dark palette as the landing — the guide is part of the
 * public surface, not the themed app. */
const BG = "bg-[#060a09]";
const CARD = "bg-[#0c1210]";
const LINE = "border-white/[0.08]";
const INK = "text-[#e8efec]";
const SOFT = "text-[#8fa3a0]";
const TEAL = "text-[#2dd4bf]";

interface Step {
  icon: typeof Search;
  title: I18nKey;
  body: I18nKey;
  img: string;
  alt: string;
}

const BUYER_STEPS: Step[] = [
  { icon: Search, title: "demo.b1t", body: "demo.b1d", img: "/demo/buyer-chat.jpg", alt: "Buyer agent chat" },
  { icon: ShieldCheck, title: "demo.b2t", body: "demo.b2d", img: "/demo/buyer-pipeline.jpg", alt: "Escrow pipeline" },
  { icon: PackageCheck, title: "demo.b3t", body: "demo.b3d", img: "/demo/buyer-inbox.jpg", alt: "Inbox release" },
  { icon: MessagesSquare, title: "demo.b4t", body: "demo.b4d", img: "/demo/buyer-messages.jpg", alt: "Deal thread" },
  { icon: Star, title: "demo.b5t", body: "demo.b5d", img: "/demo/buyer-sellers.jpg", alt: "My sellers" },
];

const SELLER_STEPS: Step[] = [
  { icon: Zap, title: "demo.s1t", body: "demo.s1d", img: "/demo/seller-home.jpg", alt: "Live feed" },
  { icon: PackageCheck, title: "demo.sit", body: "demo.sid", img: "/demo/seller-inventory-edit.jpg", alt: "Product editor" },
  { icon: Truck, title: "demo.s2t", body: "demo.s2d", img: "/demo/seller-orders.jpg", alt: "Seller orders" },
  { icon: Send, title: "demo.s3t", body: "demo.s3d", img: "/demo/seller-customers.jpg", alt: "Customers CRM" },
  { icon: MessagesSquare, title: "demo.s4t", body: "demo.s4d", img: "/demo/seller-messages.jpg", alt: "Seller thread" },
  { icon: Bot, title: "demo.s5t", body: "demo.s5d", img: "/demo/seller-copilot.jpg", alt: "Try your agent" },
];

function CredCard({
  label,
  user,
  icon: Icon,
}: {
  label: I18nKey;
  user: string;
  icon: typeof User;
}) {
  const { t } = usePrefs();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (what: string, v: string) => {
    void navigator.clipboard?.writeText(v);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className={`rounded-2xl border ${LINE} ${CARD} p-5 text-left`}>
      <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest ${SOFT}`}>
        <Icon className={`h-3.5 w-3.5 ${TEAL}`} /> {t(label)}
      </div>
      {[
        { k: "user", label: t("demo.user"), v: user },
        { k: "pass", label: t("demo.pass"), v: "ParleyJudgeDemo26" },
      ].map((row) => (
        <button
          key={row.k}
          onClick={() => copy(row.k, row.v)}
          className={`mt-3 flex w-full items-center justify-between rounded-lg border ${LINE} bg-black/30 px-3 py-2 transition-colors hover:border-[#2dd4bf]/40`}
        >
          <span className="text-left">
            <span className={`block text-[10px] uppercase tracking-wider ${SOFT}`}>{row.label}</span>
            <span className="font-mono text-[14px]">{row.v}</span>
          </span>
          {copied === row.k ? (
            <Check className={`h-4 w-4 ${TEAL}`} />
          ) : (
            <Copy className={`h-4 w-4 ${SOFT}`} />
          )}
        </button>
      ))}
    </div>
  );
}

function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border ${LINE} ${CARD} shadow-2xl shadow-black/50`}>
      {/* browser chrome — makes the capture read as "the real app" */}
      <div className={`flex items-center gap-1.5 border-b ${LINE} bg-[#0a0f0d] px-3 py-2`}>
        <span className="h-2 w-2 rounded-full bg-[#3a4a46]" />
        <span className="h-2 w-2 rounded-full bg-[#3a4a46]" />
        <span className="h-2 w-2 rounded-full bg-[#3a4a46]" />
        <span className={`mx-auto rounded-md bg-white/[0.04] px-3 py-0.5 font-mono text-[10px] ${SOFT}`}>
          parley-wt1k.onrender.com
        </span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- doc asset */}
      <img src={src} alt={alt} className="w-full" loading="lazy" />
    </div>
  );
}

function Track({
  id,
  title,
  steps,
  flip,
}: {
  id: string;
  title: I18nKey;
  steps: Step[];
  flip?: boolean;
}) {
  const { t } = usePrefs();
  return (
    <section id={id} className="mx-auto max-w-6xl px-5 py-20">
      <Reveal>
        <div className="mb-14 text-center">
          <span className={`inline-flex items-center gap-2 rounded-full border ${LINE} px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] ${TEAL}`}>
            {id === "buyer" ? <User className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
            {t(title)}
          </span>
        </div>
      </Reveal>
      <div className="space-y-20">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const left = flip ? i % 2 === 1 : i % 2 === 0;
          return (
            <Reveal key={s.title} delay={80}>
              <div className={`grid items-center gap-8 md:grid-cols-2 ${left ? "" : "md:[&>*:first-child]:order-2"}`}>
                <Shot src={s.img} alt={s.alt} />
                <div>
                  <div className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] ${SOFT}`}>
                    <span className={`grid h-8 w-8 place-items-center rounded-full border ${LINE} ${CARD} font-display text-[13px] ${TEAL}`}>
                      {i + 1}
                    </span>
                    {t("demo.step")} {i + 1} / {steps.length}
                  </div>
                  <h3 className="mt-4 flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight md:text-2xl">
                    <Icon className={`h-5 w-5 ${TEAL}`} /> {t(s.title)}
                  </h3>
                  <p className={`mt-3 max-w-md text-[14px] leading-relaxed ${SOFT}`}>{t(s.body)}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function DemoGuide() {
  const { t } = usePrefs();
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const progress = () => {
    if (typeof document === "undefined") return 0;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    return total > 0 ? Math.min(1, scrollY / total) : 0;
  };

  return (
    <div className={`min-h-screen ${BG} ${INK}`}>
      <div
        className="fixed left-0 top-0 z-[60] h-[2px] bg-gradient-to-r from-[#0d9488] to-[#2dd4bf] transition-[width] duration-150 ease-out"
        style={{ width: `${progress() * 100}%` }}
      />

      {/* ── Nav ── */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b ${LINE} ${BG}/70 backdrop-blur-xl`}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7 text-[#2dd4bf]" />
            <span className="font-display text-[15px] font-semibold tracking-tight">Parley</span>
          </Link>
          <nav className={`hidden items-center gap-5 text-[13px] ${SOFT} md:flex`}>
            <a href="#creds" className="transition-colors hover:text-white">{t("demo.nav.creds")}</a>
            <a href="#buyer" className="transition-colors hover:text-white">{t("demo.buyerTrack")}</a>
            <a href="#seller" className="transition-colors hover:text-white">{t("demo.sellerTrack")}</a>
            <Link href="/s/parcelpro-supply" className="transition-colors hover:text-white">
              {t("demo.nav.store")}
            </Link>
          </nav>
          <Link
            href="/login"
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#2dd4bf] px-3.5 py-1.5 text-[12px] font-semibold text-[#06211d] transition hover:bg-[#5eead4]"
          >
            <LogIn className="h-3.5 w-3.5" /> {t("demo.signin")}
          </Link>
        </div>
      </header>

      {/* ── Hero + credentials ── */}
      <section id="creds" className="mx-auto max-w-4xl px-5 pb-10 pt-32 text-center">
        <Reveal>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.25em] ${TEAL}`}>
            {t("demo.eyebrow")}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {t("demo.h1")}
          </h1>
          <p className={`mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed ${SOFT}`}>
            {t("demo.sub")}
          </p>
        </Reveal>
        <Reveal delay={120}>
          <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
            <CredCard label="demo.buyerCard" user="buyer1" icon={User} />
            <CredCard label="demo.sellerCard" user="seller1" icon={Store} />
          </div>
          <p className={`mt-5 flex items-center justify-center gap-2 text-[12px] ${SOFT}`}>
            <KeyRound className="h-3.5 w-3.5" /> {t("demo.noLogin")}{" "}
            <Link href="/s/parcelpro-supply" className={`font-medium underline decoration-[#2dd4bf]/50 underline-offset-4 ${TEAL}`}>
              {t("demo.nav.store")} →
            </Link>
          </p>
        </Reveal>
      </section>

      <Track id="buyer" title="demo.buyerTrack" steps={BUYER_STEPS} />
      <Track id="seller" title="demo.sellerTrack" steps={SELLER_STEPS} flip />

      {/* ── Footer CTA ── */}
      <section className="mx-auto max-w-4xl px-5 pb-24 pt-6">
        <Reveal>
          <div className={`rounded-2xl border ${LINE} ${CARD} p-8 text-center md:p-10`}>
            <h2 className="font-display text-2xl font-semibold tracking-tight">{t("demo.ready")}</h2>
            <p className={`mx-auto mt-3 max-w-xl text-[13px] leading-relaxed ${SOFT}`}>
              {t("demo.sandbox")}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-lg bg-[#2dd4bf] px-5 py-2.5 text-[13px] font-semibold text-[#06211d] transition hover:bg-[#5eead4]"
              >
                <User className="h-4 w-4" /> {t("demo.ctaBuyer")}
              </Link>
              <Link
                href="/login"
                className={`flex items-center gap-2 rounded-lg border ${LINE} px-5 py-2.5 text-[13px] font-semibold transition hover:border-[#2dd4bf]/40`}
              >
                <Store className="h-4 w-4" /> {t("demo.ctaSeller")}
              </Link>
              <Link href="/s/parcelpro-supply" className={`flex items-center gap-1 text-[13px] font-medium ${TEAL}`}>
                {t("demo.store")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
