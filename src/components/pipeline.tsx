"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PackageCheck, PackageX, Truck, CheckCircle2, Circle } from "lucide-react";
import { usePrefs } from "./preferences";

interface Order {
  id: string;
  title: string;
  vendor: string | null;
  amountCents: number;
  capturedCents: number;
  status: string;
  stage: number; // 0..4, -1 = voided/cancelled/failed
  overdue: boolean;
  expectedDelivery: string;
  createdAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  carrier: string | null;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const STEPS = ["created", "approved", "authorized", "delivered", "captured"] as const;

const STATUS_TONE: Record<string, string> = {
  captured: "bg-ok/15 text-ok",
  delivered: "bg-ok/15 text-ok",
  authorized: "bg-accent/15 text-accent",
  approved: "bg-accent/15 text-accent",
  created: "bg-ink-soft/15 text-ink-soft",
  voided: "bg-danger/15 text-danger",
  cancelled: "bg-danger/15 text-danger",
  failed: "bg-danger/15 text-danger",
};

/** Order pipeline — every escrow as a readable lifecycle card. */
export function Pipeline({ role }: { role: string }) {
  const { t } = usePrefs();
  const [orders, setOrders] = useState<Order[] | null>(null);

  const load = () =>
    fetch("/api/pipeline-data")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOrders(d.orders ?? []))
      .catch(() => setOrders([]));

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (orders === null)
    return (
      <div className="grid h-40 place-items-center text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  if (orders.length === 0)
    return (
      <div className="m-6 rounded-xl border border-line bg-card p-10 text-center">
        <PackageCheck className="mx-auto h-8 w-8 text-ok" />
        <p className="mt-3 font-medium">{t("pipe.empty")}</p>
        <p className="mt-1 text-xs text-ink-soft">{t("pipe.emptySub")}</p>
      </div>
    );

  return (
    <div className="space-y-3 p-6">
      {orders.map((o) => {
        const terminal = o.stage === -1;
        const releaseReady = o.status === "delivered" && role === "admin";
        return (
          <div
            key={o.id}
            className={`rounded-xl border bg-card p-4 ${
              o.overdue ? "border-danger/50" : "border-line"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{o.title}</div>
                <div className="mt-0.5 text-[11px] text-ink-soft">
                  {o.vendor ?? "vendor"} · {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ""}
                  {o.trackingNumber && (
                    <> · <Truck className="mb-0.5 inline h-3 w-3" /> {o.carrier} {o.trackingNumber}</>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold">{usd(o.amountCents)}</div>
                {o.capturedCents > 0 && o.capturedCents < o.amountCents && (
                  <div className="text-[11px] text-ok">{usd(o.capturedCents)} {t("pipe.partial")}</div>
                )}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONE[o.status] ?? STATUS_TONE.created}`}>
                  {o.overdue ? `${o.status} · ${t("pipe.overdue")}` : o.status}
                </span>
              </div>
            </div>

            {/* Lifecycle stepper */}
            <div className="mt-3 flex items-center">
              {terminal ? (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-danger">
                  <PackageX className="h-3.5 w-3.5" /> {o.status} — {t("pipe.terminal")}
                </div>
              ) : (
                STEPS.map((s, i) => (
                  <div key={s} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      {i < o.stage ? (
                        <CheckCircle2 className="h-4 w-4 text-ok" />
                      ) : i === o.stage ? (
                        <CheckCircle2 className={`h-4 w-4 ${o.overdue ? "text-danger" : "text-accent"}`} />
                      ) : (
                        <Circle className="h-4 w-4 text-line" />
                      )}
                      <span className={`text-[9px] uppercase tracking-wide ${i <= o.stage ? "text-ink" : "text-ink-soft/60"}`}>
                        {t(`pipe.st.${s}`)}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`mx-1 mb-4 h-px flex-1 ${i < o.stage ? "bg-ok" : "bg-line"}`} />
                    )}
                  </div>
                ))
              )}
            </div>

            {releaseReady && (
              <div className="mt-3 border-t border-line pt-3">
                <Link
                  href="/inbox"
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong"
                >
                  <PackageCheck className="h-3.5 w-3.5" /> {t("pipe.release")}
                </Link>
              </div>
            )}
            {o.overdue && !terminal && (
              <div className="mt-2 text-[11px] text-danger">
                {t("pipe.lateNote")} {new Date(o.expectedDelivery).toLocaleDateString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
