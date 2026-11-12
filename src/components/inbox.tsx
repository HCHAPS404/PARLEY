"use client";

import { useEffect, useState } from "react";
import {
  Bell, CheckCircle2, PackageCheck, RefreshCcw, Tag, TriangleAlert, TrendingDown, XCircle, ExternalLink, Loader2,
} from "lucide-react";
import { usePrefs } from "./preferences";

interface Alert {
  id: number;
  kind: string;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

const KIND_META: Record<string, { icon: typeof Bell; label: string; tone: string }> = {
  delivered: { icon: PackageCheck, label: "inbox.kind.delivered", tone: "text-ok" },
  reorder_created: { icon: RefreshCcw, label: "inbox.kind.reorderCreated", tone: "text-accent" },
  reorder_ready: { icon: RefreshCcw, label: "inbox.kind.reorderReady", tone: "text-warn" },
  delivery_overdue: { icon: TriangleAlert, label: "inbox.kind.deliveryOverdue", tone: "text-danger" },
  sale_closed: { icon: CheckCircle2, label: "inbox.kind.saleClosed", tone: "text-ok" },
  buyer_walked: { icon: TriangleAlert, label: "inbox.kind.buyerWalked", tone: "text-warn" },
  price_drop: { icon: TrendingDown, label: "inbox.kind.priceDrop", tone: "text-accent" },
  deal_found: { icon: Tag, label: "inbox.kind.dealFound", tone: "text-ok" },
  offer_received: { icon: Tag, label: "inbox.kind.offerReceived", tone: "text-accent" },
  offer_accepted: { icon: CheckCircle2, label: "inbox.kind.offerAccepted", tone: "text-ok" },
  offer_declined: { icon: XCircle, label: "inbox.kind.offerDeclined", tone: "text-danger" },
};

export function InboxPanel({ role }: { role: string }) {
  const { t } = usePrefs();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => setAlerts([]));

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  async function act(alertId: number, action: string) {
    setBusy(alertId);
    setError(null);
    try {
      const r = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alertId, action }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error ?? t("inbox.actionFailed"));
      else if (d.approveUrl) window.open(d.approveUrl, "_blank", "noopener");
      await load();
    } finally {
      setBusy(null);
    }
  }

  /** Targeted offers route through /api/offers — accept creates a real escrow
   * order and returns the PayPal approval link; then the alert is dismissed. */
  async function actOffer(alertId: number, offerId: string, action: "accept" | "decline") {
    setBusy(alertId);
    setError(null);
    try {
      const r = await fetch("/api/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, offerId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t("inbox.actionFailed"));
        return;
      }
      if (d.approveUrl) window.open(d.approveUrl, "_blank", "noopener");
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alertId, action: "dismiss" }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function checkNow() {
    setChecking(true);
    setError(null);
    try {
      const r = await fetch("/api/jobs/run", { method: "POST" });
      if (!r.ok) setError(t("inbox.watchdogFailed"));
      await load();
    } finally {
      setChecking(false);
    }
  }

  if (alerts === null)
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-line bg-card p-4"
          >
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-line/60" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-1/3 animate-pulse rounded bg-line/60" />
              <div className="h-2.5 w-2/3 animate-pulse rounded bg-line/40" />
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-6">
      <div className="flex justify-end">
        <button
          onClick={checkNow}
          disabled={checking}
          className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[11px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
        >
          <RefreshCcw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
          {checking ? t("inbox.checking") : t("inbox.checkNow")}
        </button>
      </div>
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      {alerts.length === 0 && (
        <div className="rounded-xl border border-line bg-card p-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- illustration */}
          <img
            src="/gen/empty-inbox.webp"
            alt=""
            className="mx-auto h-28 w-28 rounded-2xl object-cover"
          />
          <p className="mt-3 font-medium">{t("inbox.empty")}</p>
          <p className="mt-1 text-xs text-ink-soft">{t("inbox.emptySub")}</p>
        </div>
      )}
      {alerts.map((a) => {
        const meta = KIND_META[a.kind] ?? KIND_META.delivery_overdue;
        const Icon = meta.icon;
        const p = a.payload ?? {};
        const title = (p.title as string) ?? (p.query as string) ?? "—";
        return (
          <div key={a.id} className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              {typeof p.image === "string" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-md border border-line bg-white object-contain"
                />
              ) : (
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.tone}`} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    {t(meta.label as never)}
                  </span>
                  <span className="text-[10px] text-ink-soft">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-sm font-medium">{title}</div>
                {typeof p.priceUsd === "number" && (
                  <div className="text-sm text-ink-soft">${p.priceUsd.toFixed(2)}</div>
                )}
                {typeof p.reason === "string" && (
                  <div className="mt-1 text-xs text-ink-soft">{p.reason}</div>
                )}
                {typeof p.trackingNumber === "string" && (
                  <div className="mt-1 font-mono text-[11px] text-ink-soft">
                    tracking {p.trackingNumber}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2 pl-8">
              {typeof p.buyUrl === "string" && (
                <a
                  href={p.buyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 rounded-md bg-ok px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {t("inbox.viewOffer")}
                </a>
              )}
              {a.kind === "delivered" && role !== "demo" && (
                <button
                  onClick={() => act(a.id, "release")}
                  disabled={busy === a.id}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("inbox.release")}
                </button>
              )}
              {a.kind === "offer_received" && role !== "demo" && typeof p.offerId === "string" && (
                <>
                  <button
                    onClick={() => actOffer(a.id, String(p.offerId), "accept")}
                    disabled={busy === a.id}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                  >
                    {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("inbox.acceptOffer")}
                  </button>
                  <button
                    onClick={() => actOffer(a.id, String(p.offerId), "decline")}
                    disabled={busy === a.id}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {t("inbox.declineOffer")}
                  </button>
                </>
              )}
              {a.kind === "sale_closed" && role !== "demo" && typeof p.saleId === "string" && (
                <button
                  onClick={() => act(a.id, "issueInvoice")}
                  disabled={busy === a.id}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("inbox.issueInvoice")}
                </button>
              )}
              {a.kind === "reorder_created" && (
                <button
                  onClick={() => act(a.id, "approveReorder")}
                  disabled={busy === a.id}
                  className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><ExternalLink className="h-3.5 w-3.5" /> {t("inbox.approvePaypal")}</>}
                </button>
              )}
              {(a.kind === "reorder_ready" || a.kind === "delivery_overdue" || a.kind === "delivered" || a.kind === "sale_closed" || a.kind === "price_drop" || a.kind === "deal_found" || a.kind === "buyer_walked" || a.kind === "offer_accepted" || a.kind === "offer_declined" || a.kind === "offer_received") && (
                <button
                  onClick={() => act(a.id, "dismiss")}
                  disabled={busy === a.id}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                >
                  <span className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" /> {t("inbox.dismiss")}
                  </span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
