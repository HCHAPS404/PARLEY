"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageCheck, PackageX, Receipt, Truck, X } from "lucide-react";
import { usePrefs } from "./preferences";

interface Order {
  id: string;
  title: string;
  vendor: string | null;
  amountCents: number;
  capturedCents: number;
  status: string;
  stage: number;
  overdue: boolean;
  expectedDelivery: string;
  createdAt: string | null;
  updatedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  trackingStatus: string | null;
  invoiceId: string | null;
  authorizationExpiresAt: string | null;
  quantity: number;
  agreedPriceCents: number | null;
  negotiated: boolean;
  negotiationId: string | null;
  disputeNote: string | null;
  disputedAt: string | null;
  reorderRuleId: string | null;
}

interface NegTurn {
  speaker: "buyer" | "merchant";
  text: string;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Kanban columns: where each escrow sits in its lifecycle. */
const COLS = [
  { key: "escrow", match: (o: Order) => o.stage >= 0 && o.stage < 3, tone: "text-accent", dot: "bg-accent" },
  { key: "delivered", match: (o: Order) => o.status === "delivered", tone: "text-ok", dot: "bg-ok" },
  { key: "released", match: (o: Order) => o.status === "captured", tone: "text-ok", dot: "bg-ok" },
  { key: "closed", match: (o: Order) => o.stage === -1, tone: "text-ink-soft", dot: "bg-ink-soft/50" },
] as const;

export function Pipeline({ role }: { role: string }) {
  const { t } = usePrefs();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/pipeline-data")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setOrders(d.orders ?? []))
        .catch(() => setOrders([]));
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (orders === null)
    return (
      <div className="grid h-full grid-cols-4 divide-x divide-line overflow-x-auto">
        {[0, 1, 2, 3].map((c) => (
          <section key={c} className="flex min-w-[240px] flex-col p-3">
            <div className="mb-3 h-3 w-1/3 animate-pulse rounded bg-line/60" />
            {[0, 1].map((i) => (
              <div
                key={i}
                className="mb-2 h-24 animate-pulse rounded-lg border border-line bg-card"
              />
            ))}
          </section>
        ))}
      </div>
    );

  if (orders.length === 0)
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <PackageCheck className="mx-auto h-8 w-8 text-ok" />
          <p className="mt-3 font-medium">{t("pipe.empty")}</p>
          <p className="mt-1 text-xs text-ink-soft">{t("pipe.emptySub")}</p>
        </div>
      </div>
    );

  return (
    <div className="grid h-full grid-cols-4 divide-x divide-line overflow-x-auto">
      {COLS.map((col) => {
        const items = orders.filter(col.match);
        return (
          <section key={col.key} className="flex min-w-[240px] flex-col">
            <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
              <h2 className={`text-[11px] font-semibold uppercase tracking-wide ${col.tone}`}>
                {t(`pipe.col.${col.key}`)}
              </h2>
              <span className="ml-auto rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                {items.length}
              </span>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {items.map((o) => (
                <article
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className={`cursor-pointer rounded-lg border bg-card p-3 transition-all ${
                    o.overdue
                      ? "border-danger/50"
                      : "border-line hover:-translate-y-0.5 hover:border-ink-soft/40 hover:shadow-sm"
                  }`}
                >
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">{o.title}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-ink-soft">
                    <span className="truncate">{o.vendor ?? "—"}</span>
                    <span className="ml-2 shrink-0 font-semibold text-ink">{usd(o.amountCents)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-ink-soft">{o.status}</span>
                    {o.overdue && (
                      <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-danger">
                        {t("pipe.overdue")}
                      </span>
                    )}
                  </div>
                  {o.trackingNumber && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-soft">
                      <Truck className="h-3 w-3" /> {o.carrier} · {o.trackingNumber}
                    </div>
                  )}
                  {o.status === "delivered" && role !== "demo" && (
                    <Link
                      href="/inbox"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-[11px] font-medium text-white hover:bg-accent-strong"
                    >
                      <PackageCheck className="h-3 w-3" /> {t("pipe.release")}
                    </Link>
                  )}
                  {o.stage === -1 && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-danger">
                      <PackageX className="h-3 w-3" /> {t("pipe.terminal")}
                    </div>
                  )}
                </article>
              ))}
              {items.length === 0 && (
                <p className="px-1 pt-2 text-[11px] text-ink-soft/60">—</p>
              )}
            </div>
          </section>
        );
      })}
      {selected && (
        <OrderDrawer order={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/** Slide-over order detail — the escrow's life so far, step by step. */
function OrderDrawer({
  order: o,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { t } = usePrefs();
  const [neg, setNeg] = useState<{ transcript: NegTurn[]; listPriceCents: number; agreedCents: number | null } | null>(null);
  const [issue, setIssue] = useState("");
  const [issueBusy, setIssueBusy] = useState(false);
  const [disputed, setDisputed] = useState(o.disputeNote);

  useEffect(() => {
    if (!o.negotiationId) return;
    fetch(`/api/negotiations?id=${encodeURIComponent(o.negotiationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setNeg(d))
      .catch(() => {});
  }, [o.negotiationId]);

  const report = async () => {
    const note = issue.trim();
    if (!note || issueBusy) return;
    setIssueBusy(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "report", orderId: o.id, note }),
      });
      if (r.ok) {
        setDisputed(note);
        setIssue("");
      }
    } finally {
      setIssueBusy(false);
    }
  };

  const steps: { key: string; done: boolean; when: string | null }[] = [
    { key: "created", done: true, when: o.createdAt },
    { key: "authorized", done: o.stage >= 2, when: o.stage >= 2 ? o.updatedAt : null },
    { key: "transit", done: !!o.trackingStatus, when: o.trackingStatus ?? null },
    { key: "delivered", done: !!o.deliveredAt, when: o.deliveredAt },
    { key: "released", done: o.status === "captured", when: o.status === "captured" ? o.updatedAt : null },
  ];

  const saved =
    o.negotiated && o.agreedPriceCents != null
      ? o.amountCents - o.agreedPriceCents
      : 0;

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-line bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold leading-snug">
              {o.title}
            </h2>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-soft">
              {o.status} · {o.vendor ?? "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-soft hover:bg-paper hover:text-ink"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Money block */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line bg-paper p-3">
              <div className="text-[10px] uppercase tracking-wide text-ink-soft">{t("pipe.d.held")}</div>
              <div className="mt-1 font-display text-lg font-semibold">{usd(o.amountCents)}</div>
            </div>
            <div className="rounded-lg border border-line bg-paper p-3">
              <div className="text-[10px] uppercase tracking-wide text-ink-soft">{t("pipe.d.released")}</div>
              <div className="mt-1 font-display text-lg font-semibold text-ok">
                {usd(o.capturedCents)}
              </div>
            </div>
          </div>
          {saved > 0 && (
            <div className="rounded-lg border border-ok/30 bg-ok-soft px-3 py-2 text-[12px] font-medium text-ok">
              {t("pipe.d.saved", { n: usd(saved) })}
            </div>
          )}

          {/* Lifecycle timeline */}
          <ol className="relative space-y-4 border-l border-line pl-5">
            {steps.map((s) => (
              <li key={s.key} className="relative">
                <span
                  className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ${
                    s.done ? "bg-ok" : "border border-line bg-card"
                  }`}
                />
                <div className={`text-[12px] font-medium ${s.done ? "text-ink" : "text-ink-soft/60"}`}>
                  {t(`pipe.step.${s.key}` as never)}
                </div>
                {s.when && (
                  <div className="text-[10px] text-ink-soft">
                    {s.key === "transit" && !s.when.includes("T") ? s.when : fmt(s.when)}
                  </div>
                )}
              </li>
            ))}
            {o.stage === -1 && (
              <li className="relative">
                <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-danger" />
                <div className="text-[12px] font-medium text-danger">{t("pipe.step.closed")}</div>
              </li>
            )}
          </ol>

          {/* Facts */}
          <dl className="space-y-2.5 border-t border-line pt-4 text-[12px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">{t("pipe.d.orderId")}</dt>
              <dd className="truncate font-mono text-[11px]">{o.id}</dd>
            </div>
            {o.trackingNumber && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t("pipe.d.tracking")}</dt>
                <dd className="truncate font-mono text-[11px]">
                  {o.carrier} {o.trackingNumber}
                </dd>
              </div>
            )}
            {o.invoiceId && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t("pipe.d.invoice")}</dt>
                <dd className="flex items-center gap-1 font-mono text-[11px]">
                  <Receipt className="h-3 w-3" /> {o.invoiceId}
                </dd>
              </div>
            )}
            {o.stage >= 0 && o.stage < 4 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t("pipe.d.expected")}</dt>
                <dd>{new Date(o.expectedDelivery).toLocaleDateString()}</dd>
              </div>
            )}
            {o.reorderRuleId && (
              <div className="rounded-md bg-accent-mist px-2 py-1.5 text-[11px] font-medium text-accent-strong">
                {t("pipe.d.auto")}
              </div>
            )}
          </dl>

          {/* Open claim banner */}
          {disputed && (
            <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-warn">
                {t("pipe.d.disputeOpen")}
              </div>
              <p className="mt-1 text-[12px] text-ink">{disputed}</p>
              <p className="mt-1 text-[11px] text-ink-soft">{t("pipe.d.disputeSub")}</p>
            </div>
          )}

          {/* Agent-to-agent replay — watch the negotiation that priced this. */}
          {neg && neg.transcript.length > 0 && (
            <section className="space-y-2 border-t border-line pt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {t("pipe.d.replay")}
              </h3>
              <div className="space-y-1.5">
                {neg.transcript.map((turn, i) => (
                  <div key={i} className={`flex ${turn.speaker === "buyer" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[12px] ${
                        turn.speaker === "buyer"
                          ? "rounded-br-sm bg-accent text-paper"
                          : "rounded-bl-sm border border-line bg-paper"
                      }`}
                    >
                      <div className={`text-[9px] font-semibold uppercase tracking-wide ${turn.speaker === "buyer" ? "text-paper/70" : "text-ink-soft"}`}>
                        {turn.speaker === "buyer" ? t("pipe.d.yourAgent") : t("pipe.d.theirAgent")}
                      </div>
                      {turn.text}
                    </div>
                  </div>
                ))}
              </div>
              {neg.agreedCents != null && (
                <div className="text-[11px] font-medium text-ok">
                  {t("pipe.d.agreedAt", { n: usd(neg.agreedCents) })}
                </div>
              )}
            </section>
          )}

          {/* Report a problem — claims only make sense while money is held. */}
          {!disputed && o.stage >= 1 && o.stage < 4 && (
            <section className="space-y-2 border-t border-line pt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {t("pipe.d.problem")}
              </h3>
              <div className="flex gap-2">
                <input
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder={t("pipe.d.problemPh")}
                  className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-warn"
                />
                <button
                  onClick={report}
                  disabled={!issue.trim() || issueBusy}
                  className="rounded-md border border-warn/50 px-2.5 py-1.5 text-[11px] font-medium text-warn transition-colors hover:bg-warn/10 disabled:opacity-50"
                >
                  {issueBusy ? "…" : t("pipe.d.report")}
                </button>
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
