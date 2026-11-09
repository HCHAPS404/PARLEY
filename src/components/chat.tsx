"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  BarChart3,
  ExternalLink,
  Handshake,
  Loader2,
  LogOut,
  MessageSquare,
  PackageSearch,
  Paperclip,
  Plus,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Logo } from "./brand";
import { Markdown } from "./markdown";
import { usePrefs } from "./preferences";

const transport = new DefaultChatTransport({ api: "/api/chat" });

interface ProductCard {
  id: string;
  title: string;
  brand?: string;
  image?: string;
  bestPriceCents: number | null;
  currency: string;
  merchant?: string;
  buyUrl?: string;
  offersCount: number;
  vendorScore?: number | null;
}

const usd = (cents: number | null | undefined, cur = "USD") =>
  cents == null ? "—" : `${(cents / 100).toFixed(2)} ${cur}`;

const money = (dollars: number | null | undefined, cur = "USD") =>
  dollars == null ? "—" : `$${Number(dollars).toFixed(2)} ${cur}`;

export function ChatArea({
  user,
}: {
  user: { username: string; role: string };
}) {
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
  });
  const router = useRouter();
  const { t } = usePrefs();
  const [input, setInput] = useState("");
  const [plusKey, setPlusKey] = useState(0);
  // Image attachments — {file,url} pairs so object URLs can be revoked cleanly.
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Banner derives from PayPal redirect params once, at mount (client-only read).
  const [banner, setBanner] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    if (p.get("authorized"))
      return t("chat.bannerAuthorized", { order: p.get("authorized")! });
    if (p.get("cancelled")) return t("chat.bannerCancelled");
    if (p.get("error")) return t("chat.bannerError", { error: p.get("error")! });
    return null;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Conversation threads — isolated chats per question or procurement task.
  const [convs, setConvs] = useState<{ id: string; title: string }[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [convsLoaded, setConvsLoaded] = useState(false);
  const suppressHistory = useRef(false);

  // Load threads once; reopen the last one the user had active.
  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = (d?.conversations ?? []) as { id: string; title: string }[];
        setConvs(list);
        const last = localStorage.getItem("parley:active-conv");
        setActiveConv(list.some((c) => c.id === last) ? last : (list[0]?.id ?? null));
        setConvsLoaded(true);
      })
      .catch(() => setConvsLoaded(true));
  }, []);

  // Swap durable history whenever the active thread changes.
  useEffect(() => {
    if (!convsLoaded) return;
    if (!activeConv) {
      setMessages([]);
      return;
    }
    if (suppressHistory.current) {
      suppressHistory.current = false;
      return;
    }
    localStorage.setItem("parley:active-conv", activeConv);
    fetch(`/api/messages/history?conversationId=${encodeURIComponent(activeConv)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMessages(d?.messages ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv, convsLoaded]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Clean the PayPal query params once the banner has been derived from them.
  useEffect(() => {
    if (window.location.search) window.history.replaceState({}, "", "/app");
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async (text: string) => {
    let convId = activeConv;
    if (!convId) {
      const r = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text.slice(0, 60) }),
      });
      const d = await r.json().catch(() => null);
      convId = d?.conversation?.id ?? null;
      if (convId) {
        suppressHistory.current = true;
        setConvs((p) => [{ id: convId!, title: d.conversation.title }, ...p]);
        setActiveConv(convId);
      }
    }
    let fileList: FileList | undefined;
    if (files.length) {
      const dt = new DataTransfer();
      files.forEach(({ file }) => dt.items.add(file));
      fileList = dt.files;
      files.forEach(({ url }) => URL.revokeObjectURL(url));
      setFiles([]);
    }
    sendMessage(
      { text, files: fileList },
      { body: { conversationId: convId ?? undefined } },
    );
  };

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const ok = [...list]
      .filter((f) => f.type.startsWith("image/") && f.size <= 2 * 1024 * 1024)
      .slice(0, 4);
    setFiles((p) =>
      [...p, ...ok.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 4),
    );
  };

  const dropFile = (i: number) =>
    setFiles((p) => {
      URL.revokeObjectURL(p[i].url);
      return p.filter((_, j) => j !== i);
    });

  const selectConv = (id: string | null) => {
    if (busy || id === activeConv) return;
    if (id === null) localStorage.removeItem("parley:active-conv");
    setActiveConv(id);
  };

  const removeConv = async (id: string) => {
    if (!confirm(t("chat.deleteConvConfirm"))) return;
    await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setConvs((p) => p.filter((c) => c.id !== id));
    if (activeConv === id) {
      localStorage.removeItem("parley:active-conv");
      setActiveConv(null);
    }
  };

  const submit = () => {
    const text = input.trim();
    if ((!text && !files.length) || busy) return;
    setInput("");
    void send(text);
  };

  return (
    <div className="flex h-full">
      {/* Conversation rail */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-line bg-card md:flex">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
            {t("chat.conversations")}
          </span>
          <button
            onClick={() => selectConv(null)}
            className="rounded-md p-1 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
            title={t("chat.newChat")}
            aria-label={t("chat.newChat")}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {convs.map((c) => (
            <div
              key={c.id}
              onClick={() => selectConv(c.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] ${
                c.id === activeConv
                  ? "bg-accent-mist font-medium text-ink"
                  : "text-ink-soft hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void removeConv(c.id);
                }}
                className="hidden shrink-0 rounded p-0.5 text-ink-soft hover:text-danger group-hover:block"
                aria-label={t("chat.deleteConv")}
                title={t("chat.deleteConv")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-line bg-card px-5 py-3">
        <div className="flex items-center gap-2 md:hidden">
          <Logo className="h-6 w-6 text-accent" />
          <span className="font-display font-semibold">Parley</span>
        </div>
        <div className="hidden text-[13px] text-ink-soft md:block">
          Agentic procurement —{" "}
          <span className="text-ink">{t("app.flow")}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full border border-line px-2.5 py-1 text-ink-soft">
            {t("sidebar.sandboxBadge")}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 font-medium md:hidden ${
              user.role === "admin"
                ? "bg-accent-mist text-accent-strong"
                : "bg-paper text-ink-soft"
            }`}
            title={`Signed in as ${user.username}`}
          >
            {user.username} · {user.role}
          </span>
          <button
            onClick={logout}
            className="rounded-full border border-line p-1.5 text-ink-soft hover:text-ink md:hidden"
            title={t("nav.signOut")}
            aria-label={t("nav.signOut")}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
          <span
            className={`h-2 w-2 rounded-full ${busy ? "bg-warn animate-pulse" : "bg-ok"}`}
            title={busy ? t("chat.working") : t("chat.ready")}
          />
        </div>
      </header>

      {banner && (
        <div className="flex items-center justify-between gap-3 border-b border-warn/20 bg-warn-soft px-5 py-2.5 text-[13px] text-warn">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
          {messages.length === 0 && (
            <EmptyState onPick={(text) => void send(text)} />
          )}
          {messages.map((m) => (
            <MessageRow key={m.id} role={m.role} parts={m.parts as never[]} />
          ))}
          {busy && <Thinking />}
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-[13px] text-danger">
              {error.message}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-card px-4 py-3">
        {files.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-3xl gap-2">
            {files.map(({ url }, i) => (
              <div
                key={url}
                className="relative h-14 w-14 overflow-hidden rounded-lg border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => dropFile(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-ink/70 p-0.5 text-paper hover:bg-ink"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <PlusMenu
            onPick={(text) => {
              setInput(text);
              setPlusKey((k) => k + 1);
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              pickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || files.length >= 4}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            title={t("chat.attach")}
            aria-label={t("chat.attach")}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            key={plusKey}
            value={input}
            autoFocus
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={t("chat.placeholder")}
            className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-paper px-4 py-3 text-[14px] outline-none placeholder:text-ink-soft/60 focus:border-accent"
          />
          <button
            onClick={submit}
            disabled={busy || (!input.trim() && !files.length)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
            aria-label={t("chat.send")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-ink-soft">
          {t("chat.footer")}
        </p>
      </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { t } = usePrefs();
  return (
    <div className="mt-16 text-center">
      <Logo className="mx-auto h-12 w-12 text-accent/70" />
      <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
        {t("empty.title")}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-ink-soft">
        {t("empty.subtitle")}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-[12px]">
        {(
          [
            "empty.chip1",
            "empty.chip2",
            "empty.chip3",
            "empty.chip4",
          ] as const
        ).map((k) => (
          <button
            key={k}
            onClick={() => onPick(t(k))}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-ink-soft transition-all hover:-translate-y-px hover:border-accent hover:text-accent-strong hover:shadow-sm"
          >
            {t(k)}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlusMenu({ onPick }: { onPick: (text: string) => void }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items = [
    "plus.q1",
    "plus.q2",
    "plus.q3",
    "plus.q4",
    "plus.q5",
    "plus.q6",
    "plus.q7",
    "plus.q8",
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors ${
          open
            ? "border-accent bg-accent-mist text-accent-strong"
            : "border-line text-ink-soft hover:border-accent/50 hover:text-ink"
        }`}
        aria-label={t("plus.title")}
      >
        <Plus className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 z-30 w-80 overflow-hidden rounded-xl border border-line bg-card shadow-lg shadow-ink/10">
          <div className="border-b border-line/60 px-3.5 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
            {t("plus.title")}
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {items.map((k) => (
              <button
                key={k}
                onClick={() => {
                  onPick(t(k));
                  setOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-accent-mist hover:text-accent-strong"
              >
                {t(k)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Thinking() {
  const { t } = usePrefs();
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-soft">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t("chat.thinking")}
    </div>
  );
}

function MessageRow({ role, parts }: { role: string; parts: never[] }) {
  if (role === "user") {
    const text = parts
      .filter((p) => (p as { type: string }).type === "text")
      .map((p) => (p as { text?: string }).text ?? "")
      .join("");
    const images = parts.filter(
      (p) =>
        (p as { type: string }).type === "file" &&
        (p as { mediaType?: string }).mediaType?.startsWith("image/") &&
        (p as { url?: string }).url,
    );
    return (
      <div className="flex flex-col items-end gap-2">
        {images.length > 0 && (
          <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
            {images.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={(p as { url: string }).url}
                alt=""
                className="max-h-40 rounded-xl border border-line object-cover"
              />
            ))}
          </div>
        )}
        {text && (
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-[14px] leading-6 text-paper">
            {text}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-accent-mist">
        <Logo className="h-4.5 w-4.5 text-accent-strong" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {parts.map((p, i) => (
          <Part key={i} part={p} />
        ))}
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function Part({ part }: { part: any }) {
  if (part.type === "text") {
    return (
      <div className="w-fit max-w-full rounded-2xl rounded-tl-sm border border-line bg-card px-4 py-3 text-[14px] leading-6 text-ink/90">
        <Markdown>{part.text}</Markdown>
      </div>
    );
  }
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return <ToolPart part={part} />;
  }
  return null;
}

function ToolPart({ part }: { part: any }) {
  const name = part.toolName ?? part.type.replace("tool-", "");
  const done = part.state === "output-available";

  if (name === "search_products" && done && part.output?.products?.length) {
    return <ProductGrid products={part.output.products} />;
  }
  if (name === "market_report" && done && part.output?.merchantCount != null) {
    return <MarketReportCard output={part.output} />;
  }
  if (name === "merchant_quote" && done && part.output?.transcript) {
    return <NegotiationCard output={part.output} />;
  }
  if (name === "create_escrow_order" && done) {
    return <EscrowCard output={part.output} />;
  }
  if (
    (name === "confirm_delivery_release" || name === "void_escrow_order") &&
    done
  ) {
    return <EscrowResultCard output={part.output} voided={name === "void_escrow_order"} />;
  }
  if (name === "get_escrow_status" && done) {
    return <EscrowStatusCard output={part.output} />;
  }
  if (name === "list_orders" && done && part.output?.orders?.length) {
    return <OrdersTableCard orders={part.output.orders} />;
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[12px] text-ink-soft">
      <Wrench className="h-3 w-3" />
      <span className="font-mono">{name}</span>
      {!done && <Loader2 className="h-3 w-3 animate-spin" />}
      {done && part.output?.error && (
        <span className="text-danger">— {String(part.output.error).slice(0, 80)}</span>
      )}
    </div>
  );
}

function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="grid h-full place-items-center bg-paper">
        <PackageSearch className="h-9 w-9 text-ink-soft/40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="block h-full w-full object-contain p-3"
      loading="lazy"
    />
  );
}

function ProductGrid({ products }: { products: ProductCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.slice(0, 6).map((p) => (
        <div
          key={p.id}
          className="group flex flex-col overflow-hidden rounded-xl border border-line bg-card transition-all hover:border-accent/50 hover:shadow-md"
        >
          <div className="relative h-36 shrink-0 overflow-hidden bg-white">
            <ProductImage src={p.image} alt={p.title} />
            {p.offersCount > 1 && (
              <span className="absolute right-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-medium text-paper">
                {p.offersCount} offers
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col border-t border-line/60 p-3">
            <div className="line-clamp-2 min-h-[2.1rem] text-[13px] font-medium leading-snug">
              {p.title}
            </div>
            <div className="mt-auto flex items-end justify-between gap-2 pt-2">
              <div className="min-w-0">
                <div className="font-display text-[15px] font-semibold text-ink">
                  {usd(p.bestPriceCents, p.currency)}
                </div>
                <div className="truncate text-[11px] text-ink-soft">
                  {p.merchant}
                  {p.brand ? ` · ${p.brand}` : ""}
                </div>
              </div>
              {p.vendorScore != null && (
                <span
                  className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${
                    p.vendorScore >= 70
                      ? "bg-ok-soft text-ok"
                      : p.vendorScore >= 45
                        ? "bg-warn-soft text-warn"
                        : "bg-danger-soft text-danger"
                  }`}
                  title={`Vendor reputation: ${p.vendorScore}/100 (learned from deliveries)`}
                >
                  {p.vendorScore}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function MarketReportCard({ output }: { output: any }) {
  const trend = output.priceTrend90d;
  const pts: number[] = output.sparkPoints ?? [];
  const w = 120;
  const h = 28;
  const spark =
    pts.length > 1
      ? pts
          .map((c, i) => {
            const min = Math.min(...pts);
            const max = Math.max(...pts);
            const x = (i / (pts.length - 1)) * w;
            const y = h - 2 - ((c - min) / Math.max(1, max - min)) * (h - 4);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")
      : null;
  const up = (trend?.trendPct ?? 0) > 2;
  const down = (trend?.trendPct ?? 0) < -2;
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-ink-soft">
        <BarChart3 className="h-4 w-4 text-accent" />
        Market report — {output.query}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "merchants", value: output.merchantCount },
          { label: "alternatives", value: output.alternativesCount ?? "—" },
          {
            label: "price spread",
            value: output.priceRangeUsd
              ? `$${output.priceRangeUsd.min}–$${output.priceRangeUsd.max}`
              : "—",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-paper px-2 py-2">
            <div className="font-display text-[15px] font-semibold">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wide text-ink-soft">
              {s.label}
            </div>
          </div>
        ))}
      </div>
      {trend && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line/60 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              {up ? (
                <TrendingUp className="h-3.5 w-3.5 text-ok" />
              ) : down ? (
                <TrendingDown className="h-3.5 w-3.5 text-danger" />
              ) : null}
              {trend.trendPct != null && `${trend.trendPct > 0 ? "+" : ""}${trend.trendPct}%`}
              <span className="font-normal text-ink-soft">90d · now ${trend.currentUsd}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-ink-soft">
              avg ${trend.meanUsd} · range ${trend.minUsd}–${trend.maxUsd}
              {trend.status ? ` · ${trend.status}` : ""}
            </div>
          </div>
          {spark && (
            <svg width={w} height={h} className="shrink-0 text-accent" aria-hidden>
              <polyline
                points={spark}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}
      {output.benchmarkProduct && (
        <div className="mt-2 truncate text-[11px] text-ink-soft">
          Benchmark: {output.benchmarkProduct.title} — $
          {output.benchmarkProduct.priceUsd} @ {output.benchmarkProduct.merchant}
        </div>
      )}
    </div>
  );
}

function NegotiationCard({ output }: { output: any }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-ink-soft">
        <Handshake className="h-4 w-4 text-accent" />
        Agent-to-agent — Parley × {output.merchantName ?? "Merchant"} · round {output.round}/{output.maxRounds}
        {output.merchantPriceUsd != null && (
          <span className="font-mono text-[11px] text-ink-soft">${output.merchantPriceUsd}</span>
        )}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
            output.status === "agreed"
              ? "bg-ok-soft text-ok"
              : output.status === "walked"
                ? "bg-danger-soft text-danger"
                : "bg-warn-soft text-warn"
          }`}
        >
          {output.status}
        </span>
      </div>
      <div className="space-y-2">
        {(output.transcript ?? []).map((t: any, i: number) => (
          <div
            key={i}
            className={`flex ${t.speaker === "buyer" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] ${
                t.speaker === "buyer"
                  ? "bg-accent-mist text-accent-strong"
                  : "bg-paper text-ink"
              }`}
            >
              <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                {t.speaker === "buyer" ? "Parley" : (output.merchantName ?? "Merchant")}
              </span>
              {t.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EscrowCard({ output }: { output: any }) {
  if (output.allowed === false) {
    return (
      <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn">
        <span className="font-medium">Policy denied —</span> {output.reason}
      </div>
    );
  }
  if (output.error) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-[13px] text-danger">
        {output.error}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-accent/30 bg-accent-mist p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-accent-strong">
        <ShieldCheck className="h-4 w-4" />
        Escrow order created — {money(output.holdTotalUsd, output.currency)} held
      </div>
      <p className="mt-1.5 text-[12px] leading-5 text-ink-soft">
        {output.escrowNote}
      </p>
      {output.approveUrl && (
        <a
          href={output.approveUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-strong"
        >
          Approve on PayPal
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <div className="mt-2 font-mono text-[10px] text-ink-soft/70">
        order {output.orderId}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  captured: "bg-ok-soft text-ok",
  authorized: "bg-accent-soft text-accent-strong",
  approved: "bg-accent-mist text-accent-strong",
  created: "bg-warn-soft text-warn",
  voided: "bg-paper text-ink-soft",
  cancelled: "bg-paper text-ink-soft",
  expired: "bg-warn-soft text-warn",
  failed: "bg-danger-soft text-danger",
};

function StatusPill({ status }: { status?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        STATUS_TONE[status ?? ""] ?? "bg-paper text-ink-soft"
      }`}
    >
      {status}
    </span>
  );
}

/* Result of confirm_delivery_release / void_escrow_order — money actually moved. */
function EscrowResultCard({
  output,
  voided,
}: {
  output: any;
  voided: boolean;
}) {
  if (output.error) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-[13px] text-danger">
        {output.error}
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl border p-4 ${
        voided ? "border-line bg-card" : "border-ok/30 bg-ok-soft"
      }`}
    >
      <div
        className={`flex items-center gap-2 text-[13px] font-medium ${
          voided ? "text-ink" : "text-ok"
        }`}
      >
        <ShieldCheck className="h-4 w-4" />
        {voided
          ? `Escrow voided — ${money(output.releasedUsd)} returned to buyer`
          : `Escrow captured — ${money(output.releasedUsd)} released to seller`}
      </div>
      {output.note && (
        <p className="mt-1.5 text-[12px] leading-5 text-ink-soft">{output.note}</p>
      )}
      <div className="mt-2 font-mono text-[10px] text-ink-soft/70">
        {output.captureId ? `capture ${output.captureId}` : `status ${output.status}`}
      </div>
    </div>
  );
}

/* Live PayPal state of one order. */
function EscrowStatusCard({ output }: { output: any }) {
  if (output.error) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-[13px] text-danger">
        {output.error}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink-soft">Escrow status</span>
        <StatusPill status={output.status} />
      </div>
      <div className="mt-2 space-y-1 font-mono text-[11px] text-ink-soft">
        <div>order {output.orderId}</div>
        {output.authorizationId && <div>auth {output.authorizationId}</div>}
        <div>captured: {output.captured ? "yes" : "no"}</div>
      </div>
    </div>
  );
}

/* The user's order history — rows rendered from verified data, not model prose. */
function OrdersTableCard({ orders }: { orders: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="border-b border-line px-4 py-2.5 text-[12px] font-medium text-ink-soft">
        Your escrow orders
      </div>
      <div className="divide-y divide-line">
        {orders.slice(0, 8).map((o: any) => (
          <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{o.title}</div>
              <div className="truncate text-[11px] text-ink-soft">
                {o.vendor}
                {o.negotiated ? " · negotiated" : ""} ·{" "}
                <span className="font-mono">{o.id}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-[13px] font-semibold">
                {money(o.totalUsd, o.currency)}
              </div>
              <StatusPill status={o.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
