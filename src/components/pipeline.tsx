"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PackageCheck, PackageX, Truck } from "lucide-react";
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
  trackingNumber: string | null;
  carrier: string | null;
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
      <div className="grid h-40 place-items-center text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin" />
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
                  className={`rounded-lg border bg-card p-3 transition-colors ${
                    o.overdue ? "border-danger/50" : "border-line hover:border-ink-soft/40"
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
    </div>
  );
}
