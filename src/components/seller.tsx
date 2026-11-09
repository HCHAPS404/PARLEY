"use client";

import { useEffect, useState } from "react";
import {
  BadgeDollarSign, Boxes, Handshake, Loader2, Plus, Store, Trash2, TrendingUp,
} from "lucide-react";
import { usePrefs } from "./preferences";
import Link from "next/link";

interface Profile { id: string; displayName: string; floorRatioPct: number; style: string }
interface Product { id: string; title: string; priceCents: number; stock: number }
interface Sale { id: string; productTitle: string; agreedCents: number; buyerLabel: string | null; trackingNumber?: string | null; status: string; createdAt: string }

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export function SellerDashboard() {
  const { t } = usePrefs();
  const [data, setData] = useState<{ profile: Profile | null; products: Product[]; sales: Sale[] } | null>(null);
  const [pTitle, setPTitle] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [shipTrack, setShipTrack] = useState<Record<string, string>>({});
  const [shipCarrier, setShipCarrier] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/seller")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d));
  useEffect(() => { load(); }, []);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    await fetch("/api/seller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    load();
  };

  if (!data)
    return (
      <div className="grid h-40 place-items-center text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  const { profile, products, sales } = data;
  const revenue = sales.reduce((s, x) => s + x.agreedCents, 0);

  if (!profile)
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <Store className="mx-auto h-10 w-10 text-accent" />
        <h2 className="mt-3 font-display text-lg font-semibold">{t("sell.empty.title")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("sell.empty.sub")}</p>
        <Link href="/settings" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">
          {t("sell.empty.cta")}
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Handshake, label: t("sell.kpi.sales"), value: String(sales.length) },
          { icon: BadgeDollarSign, label: t("sell.kpi.revenue"), value: usd(revenue) },
          { icon: Boxes, label: t("sell.kpi.products"), value: String(products.length) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-center gap-2 text-[11px] text-ink-soft">
              <Icon className="h-3.5 w-3.5 text-accent" /> {label}
            </div>
            <div className="mt-1 font-display text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {/* Agent card */}
      <div className="flex items-center justify-between rounded-xl border border-accent/25 bg-accent-mist/40 p-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
            {t("sell.agentCard")}
          </div>
          <div className="mt-0.5 font-display text-base font-semibold">{profile.displayName}</div>
          <div className="text-[12px] text-ink-soft">
            {t("sell.floor")} {profile.floorRatioPct}% · {t(`sell.${profile.style}` as never)}
          </div>
        </div>
        <Link href="/settings" className="rounded-md border border-line bg-card px-3 py-1.5 text-[12px] font-medium hover:text-ink">
          {t("sell.tune")}
        </Link>
      </div>

      {/* Catalog */}
      <div className="rounded-xl border border-line bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">{t("sell.catalog")}</h3>
          <span className="text-[11px] text-ink-soft">{t("sell.catalogHint")}</span>
        </div>
        <div className="flex gap-2">
          <input
            value={pTitle}
            onChange={(e) => setPTitle(e.target.value)}
            placeholder={t("sell.productName")}
            className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
          />
          <input
            value={pPrice}
            onChange={(e) => setPPrice(e.target.value)}
            type="number" min={1} step="0.01" placeholder="$"
            className="w-24 rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
          />
          <button
            onClick={() => { post({ action: "addProduct", title: pTitle, priceUsd: Number(pPrice) }); setPTitle(""); setPPrice(""); }}
            disabled={busy || !pTitle.trim() || !pPrice}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {t("sell.add")}
          </button>
        </div>
        {products.length === 0 ? (
          <p className="mt-4 text-center text-[12px] text-ink-soft">{t("sell.noProducts")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-[13px]">
                <span className="min-w-0 truncate">{p.title}</span>
                <span className="ml-3 flex shrink-0 items-center gap-3">
                  <span className="font-medium">{usd(p.priceCents)}</span>
                  <span className="text-[11px] text-ink-soft">×{p.stock}</span>
                  <button
                    onClick={() => post({ action: "removeProduct", productId: p.id })}
                    className="text-ink-soft transition-colors hover:text-danger"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sales feed */}
      <div className="rounded-xl border border-line bg-card p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-accent" /> {t("sell.salesFeed")}
        </h3>
        {sales.length === 0 ? (
          <p className="mt-3 text-[12px] text-ink-soft">{t("sell.noSales")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line/60">
            {sales.map((s) => (
              <li key={s.id} className="py-2.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.productTitle}</div>
                    <div className="text-[11px] text-ink-soft">
                      {s.buyerLabel ?? "agent buyer"} · {new Date(s.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <div className="font-semibold text-ok">{usd(s.agreedCents)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-ink-soft">{s.status}</div>
                  </div>
                </div>
                {(s.status === "agreed" || s.status === "invoiced") && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={shipTrack[s.id] ?? ""}
                      onChange={(e) => setShipTrack({ ...shipTrack, [s.id]: e.target.value })}
                      placeholder={t("sell.tracking")}
                      className="flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
                    />
                    <input
                      value={shipCarrier[s.id] ?? ""}
                      onChange={(e) => setShipCarrier({ ...shipCarrier, [s.id]: e.target.value })}
                      placeholder="UPS"
                      className="w-20 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
                    />
                    <button
                      onClick={() =>
                        post({ action: "ship", saleId: s.id, trackingNumber: shipTrack[s.id], carrier: shipCarrier[s.id] })
                      }
                      disabled={busy || !(shipTrack[s.id] ?? "").trim() || !(shipCarrier[s.id] ?? "").trim()}
                      className="rounded-md border border-line px-3 py-1.5 text-[12px] font-medium hover:text-ink disabled:opacity-50"
                    >
                      {t("sell.ship")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
