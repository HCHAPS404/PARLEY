"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  ExternalLink,
  Handshake,
  Loader2,
  LogOut,
  PackageSearch,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { Logo } from "./brand";

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
  const [input, setInput] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Restore durable chat history once on mount.
  useEffect(() => {
    fetch("/api/messages/history")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.messages?.length) setMessages(d.messages);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("authorized")) {
      setBanner(
        `Payment approved — funds held in escrow for order ${p.get("authorized")}. Ask the agent to confirm delivery.`,
      );
    } else if (p.get("cancelled")) {
      setBanner("PayPal approval cancelled — nothing was held.");
    } else if (p.get("error")) {
      setBanner(`Something went wrong during approval (${p.get("error")}).`);
    }
    if (p.toString()) window.history.replaceState({}, "", "/");
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-line bg-card px-5 py-3">
        <div className="flex items-center gap-2 md:hidden">
          <Logo className="h-6 w-6 text-accent" />
          <span className="font-display font-semibold">Parley</span>
        </div>
        <div className="hidden text-[13px] text-ink-soft md:block">
          Agentic procurement —{" "}
          <span className="text-ink">find · negotiate · escrow · audit</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full border border-line px-2.5 py-1 text-ink-soft">
            sandbox
          </span>
          <span
            className={`rounded-full px-2.5 py-1 font-medium ${
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
            className="rounded-full border border-line p-1.5 text-ink-soft hover:text-ink"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
          <span
            className={`h-2 w-2 rounded-full ${busy ? "bg-warn animate-pulse" : "bg-ok"}`}
            title={busy ? "working" : "ready"}
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
          {messages.length === 0 && <EmptyState />}
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
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder='Try "find a USB microphone under $80" or "negotiate the price on the second one"'
            className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-paper px-4 py-3 text-[14px] outline-none placeholder:text-ink-soft/60 focus:border-accent"
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
            aria-label="Send"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-ink-soft">
          Funds are authorized, never auto-captured — every purchase ends with
          your approval on PayPal.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 text-center">
      <Logo className="mx-auto h-12 w-12 text-accent/70" />
      <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
        What should I procure for you?
      </h1>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-ink-soft">
        I search real products, negotiate with the seller&apos;s agent, and pay
        through PayPal escrow — funds release only when delivery is confirmed.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-[12px] text-ink-soft">
        {[
          "USB microphone under $80",
          "Negotiate the second result",
          "Show my recent orders",
        ].map((s) => (
          <span
            key={s}
            className="rounded-full border border-line bg-card px-3 py-1.5"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-soft">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      working…
    </div>
  );
}

function MessageRow({ role, parts }: { role: string; parts: never[] }) {
  if (role === "user") {
    const text = parts
      .filter((p) => (p as { type: string }).type === "text")
      .map((p) => (p as { text?: string }).text ?? "")
      .join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-[14px] text-paper">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {parts.map((p, i) => (
        <Part key={i} part={p} />
      ))}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function Part({ part }: { part: any }) {
  if (part.type === "text") {
    return (
      <div className="max-w-[90%] whitespace-pre-wrap text-[14px] leading-6">
        {part.text}
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
  if (name === "merchant_quote" && done && part.output?.transcript) {
    return <NegotiationCard output={part.output} />;
  }
  if (name === "create_escrow_order" && done) {
    return <EscrowCard output={part.output} />;
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

function ProductGrid({ products }: { products: ProductCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {products.slice(0, 6).map((p) => (
        <div
          key={p.id}
          className="overflow-hidden rounded-xl border border-line bg-card"
        >
          <div className="flex gap-3 p-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-paper">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <PackageSearch className="h-5 w-5 text-ink-soft" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[13px] font-medium leading-4">
                {p.title}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-display text-[15px] font-semibold text-accent-strong">
                  {usd(p.bestPriceCents, p.currency)}
                </span>
                {p.offersCount > 1 && (
                  <span className="text-[11px] text-ink-soft">
                    {p.offersCount} offers
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-ink-soft">
                {p.merchant}
                {p.brand ? ` · ${p.brand}` : ""}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NegotiationCard({ output }: { output: any }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-ink-soft">
        <Handshake className="h-4 w-4 text-accent" />
        Agent-to-agent negotiation — round {output.round}/{output.maxRounds}
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
                {t.speaker === "buyer" ? "Parley" : "Merchant"}
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
