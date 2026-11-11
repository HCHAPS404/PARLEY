"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  BadgeDollarSign,
  Handshake,
  ImagePlus,
  Loader2,
  Percent,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";
import { usePrefs } from "./preferences";
import { Markdown } from "./markdown";
import Link from "next/link";

interface Profile { id: string; displayName: string; floorRatioPct: number; style: string }
interface Product { id: string; title: string; priceCents: number; stock: number; image: string | null }
interface Sale { id: string; productTitle: string; agreedCents: number; listCents: number | null; buyerLabel: string | null; trackingNumber?: string | null; status: string; createdAt: string }
interface SellerEvent { id: string; productTitle: string; buyerLabel: string | null; kind: string; offerCents: number | null; counterCents: number | null; message: string | null; createdAt: string }
interface Lead { buyerLabel: string | null; productTitle: string; kind: string; offerCents: number | null; counterCents: number | null; at: string }
interface Campaign { id: string; name: string; pctOff: number; productId: string | null; endsAt: string | null; active: boolean }
interface Stats {
  threads: number;
  conversionPct: number;
  avgSaleCents: number;
  avgDiscountPct: number;
  revenueCents: number;
  funnel: { offers: number; counters: number; accepts: number; walks: number };
  topProducts: { title: string; revenueCents: number; units: number }[];
  lowStockCount: number;
  pendingShipCount: number;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Photo → small JPEG data URL for the catalog (~800px, quality 0.8). */
function fileToProductImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 800;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const EV_KEY = {
  offer: "sell.ev.offer",
  counter: "sell.ev.counter",
  accept: "sell.ev.accept",
  walk: "sell.ev.walk",
} as const;

const sellerTransport = new DefaultChatTransport({ api: "/api/seller-chat" });

export type SellerView = "overview" | "copilot" | "inventory" | "orders";

export function SellerDashboard({ view }: { view: SellerView }) {
  const { t } = usePrefs();
  const [data, setData] = useState<{
    profile: Profile | null; products: Product[]; sales: Sale[];
    events: SellerEvent[]; leads: Lead[]; campaigns: Campaign[]; stats?: Stats;
    fetchedAt: number;
  } | null>(null);
  const [pTitle, setPTitle] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pStock, setPStock] = useState("");
  const [pImage, setPImage] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showCsv, setShowCsv] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [cName, setCName] = useState("");
  const [cPct, setCPct] = useState("");
  const [cProduct, setCProduct] = useState("");
  const [cDays, setCDays] = useState("");
  const [shipTrack, setShipTrack] = useState<Record<string, string>>({});
  const [shipCarrier, setShipCarrier] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/seller")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData({ ...d, fetchedAt: Date.now() }));
  useEffect(() => {
    load();
    const id = setInterval(load, 15_000); // the agent works while you watch
    return () => clearInterval(id);
  }, []);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await fetch("/api/seller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await r.json().catch(() => ({}))) as {
      error?: string;
      imported?: number;
    };
    setBusy(false);
    if (!r.ok) {
      setNotice(d.error ?? t("common.error"));
      return null;
    }
    load();
    return d;
  };

  if (!data)
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-line bg-card"
            />
          ))}
        </div>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-xl border border-line bg-card"
          />
        ))}
      </div>
    );

  const { profile, products, sales, events, leads, campaigns, stats } = data;
  const revenue = stats?.revenueCents ?? sales.reduce((s, x) => s + x.agreedCents, 0);
  const liveCampaigns = (campaigns ?? []).filter(
    (c) => c.active && (!c.endsAt || new Date(c.endsAt).getTime() > data.fetchedAt),
  );
  const campaignFor = (pid: string) =>
    liveCampaigns.find((c) => c.productId === pid) ??
    liveCampaigns.find((c) => c.productId == null) ??
    null;

  if (!profile)
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- illustration */}
        <img
          src="/gen/seller-sleep.webp"
          alt=""
          className="mx-auto h-36 w-36 rounded-2xl border border-line object-cover"
        />
        <h2 className="mt-4 font-display text-lg font-semibold">{t("sell.empty.title")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("sell.empty.sub")}</p>
        <Link href="/settings" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-strong">
          {t("sell.empty.cta")}
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      {/* Agent identity strip */}
      <div className="flex items-center justify-between rounded-xl border border-accent/25 bg-accent-mist/40 p-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
            {t("sell.agentCard")}
          </div>
          <div className="mt-0.5 font-display text-base font-semibold">{profile.displayName}</div>
          <div className="text-[12px] text-ink-soft">
            {t("sell.floor")} {profile.floorRatioPct}% · {t(`sell.${profile.style}` as never)}
            {liveCampaigns.length > 0 && (
              <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-strong">
                {liveCampaigns.length} {t("sell.campaignsLive")}
              </span>
            )}
          </div>
        </div>
        <Link href="/settings" className="rounded-md border border-line bg-card px-3 py-1.5 text-[12px] font-medium hover:text-ink">
          {t("sell.tune")}
        </Link>
      </div>

      {notice && (
        <div className="rounded-md border border-line bg-accent-mist px-3 py-2 text-[12px] text-accent-strong">
          {notice}
        </div>
      )}

      {view === "overview" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: BadgeDollarSign, label: t("sell.kpi.revenue"), value: usd(revenue) },
              { icon: Handshake, label: t("sell.kpi.sales"), value: String(sales.length) },
              { icon: TrendingUp, label: t("sell.kpi.conversion"), value: `${stats?.conversionPct ?? 0}%` },
              { icon: Tag, label: t("sell.kpi.avgDeal"), value: stats?.avgSaleCents ? usd(stats.avgSaleCents) : "—" },
              { icon: Percent, label: t("sell.kpi.avgDiscount"), value: `${stats?.avgDiscountPct ?? 0}%` },
              { icon: Truck, label: t("sell.kpi.toShip"), value: String(stats?.pendingShipCount ?? 0) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-line bg-card p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] text-ink-soft">
                  <Icon className="h-3 w-3 text-accent" /> {label}
                </div>
                <div className="mt-1 font-display text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>

          {/* Negotiation funnel */}
          <div className="rounded-xl border border-line bg-card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {t("sell.funnel")}
            </div>
            {(() => {
              const f = stats?.funnel ?? { offers: 0, counters: 0, accepts: 0, walks: 0 };
              const max = Math.max(f.offers, f.counters, f.accepts, f.walks, 1);
              const rows = [
                { k: "sell.fn.offers", v: f.offers, c: "bg-accent/60" },
                { k: "sell.fn.counters", v: f.counters, c: "bg-accent/80" },
                { k: "sell.fn.accepts", v: f.accepts, c: "bg-ok/80" },
                { k: "sell.fn.walks", v: f.walks, c: "bg-danger/60" },
              ];
              return (
                <div className="mt-3 space-y-2">
                  {rows.map((r) => (
                    <div key={r.k} className="flex items-center gap-3 text-[12px]">
                      <span className="w-24 text-ink-soft">{t(r.k as never)}</span>
                      <div className="h-4 flex-1 rounded-sm bg-paper">
                        <div
                          className={`h-full rounded-sm ${r.c} transition-all`}
                          style={{ width: `${(r.v / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-semibold">{r.v}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Sales by day */}
            {(() => {
              const days = Array.from({ length: 14 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (13 - i));
                const key = d.toISOString().slice(0, 10);
                return { key, label: `${d.getMonth() + 1}/${d.getDate()}`, cents: 0 };
              });
              const byDay = new Map(days.map((d) => [d.key, d]));
              for (const s of sales) {
                const k = s.createdAt?.slice(0, 10);
                const d = k && byDay.get(k);
                if (d) d.cents += s.agreedCents;
              }
              const max = Math.max(...days.map((d) => d.cents), 1);
              return (
                <div className="rounded-xl border border-line bg-card p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    {t("sell.chart")}
                  </div>
                  <div className="mt-3 flex h-24 items-end gap-1.5">
                    {days.map((d) => (
                      <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-accent/70"
                          style={{ height: `${Math.max(3, (d.cents / max) * 88)}%` }}
                          title={`${d.label} — ${usd(d.cents)}`}
                        />
                        <span className="text-[8px] text-ink-soft">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Top products */}
            <div className="rounded-xl border border-line bg-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {t("sell.topProducts")}
              </div>
              {!stats?.topProducts.length ? (
                <p className="mt-3 text-[12px] text-ink-soft">{t("sell.noTop")}</p>
              ) : (
                <ul className="mt-2 divide-y divide-line/60">
                  {stats.topProducts.map((p) => (
                    <li key={p.title} className="flex items-center justify-between py-2 text-[13px]">
                      <span className="min-w-0 truncate">{p.title}</span>
                      <span className="ml-3 shrink-0 text-right">
                        <span className="font-semibold">{usd(p.revenueCents)}</span>
                        <span className="ml-2 text-[11px] text-ink-soft">×{p.units}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(stats?.lowStockCount ?? 0) > 0 && (
                <div className="mt-3 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[11px] text-warn">
                  {t("sell.lowStockWarn", { n: String(stats!.lowStockCount) })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === "copilot" && <SellerCopilot onAction={load} />}

      {view === "inventory" && (
        <div className="space-y-5">
          {/* Add product */}
          <div className="rounded-xl border border-line bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">{t("sell.catalog")}</h3>
              <span className="text-[11px] text-ink-soft">{t("sell.catalogHint")}</span>
            </div>
            <div className="flex gap-2">
              {/* Image picker — the photo buyers see in search */}
              <label
                className="relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-dashed border-line bg-paper text-ink-soft transition-colors hover:border-accent hover:text-accent"
                title={t("sell.photo")}
              >
                {pImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setPImage(await fileToProductImage(f));
                    e.target.value = "";
                  }}
                />
                {pImage && (
                  <button
                    onClick={(e) => { e.preventDefault(); setPImage(null); }}
                    className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white"
                  >
                    ×
                  </button>
                )}
              </label>
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
                className="w-20 rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
              />
              <input
                value={pStock}
                onChange={(e) => setPStock(e.target.value)}
                type="number" min={0} placeholder="×10"
                className="w-16 rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
              />
              <button
                onClick={() => { post({ action: "addProduct", title: pTitle, priceUsd: Number(pPrice), stock: Number(pStock) || 10, image: pImage ?? undefined }); setPTitle(""); setPPrice(""); setPStock(""); setPImage(null); }}
                disabled={busy || !pTitle.trim() || !pPrice}
                className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-paper hover:bg-accent-strong disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {t("sell.add")}
              </button>
              <button
                onClick={() => setShowCsv((s) => !s)}
                className="rounded-md border border-line px-3 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink"
                title={t("sell.csvHint")}
              >
                CSV
              </button>
            </div>
            {showCsv && (
              <div className="mt-3">
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={4}
                  placeholder={t("sell.csvPlaceholder")}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-[12px] outline-none focus:border-accent"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-soft">{t("sell.csvHint")}</span>
                  <button
                    onClick={async () => {
                      const d = await post({ action: "importCsv", csv: csvText });
                      if (d) {
                        setCsvText("");
                        setShowCsv(false);
                        setNotice(t("sell.csvDone", { n: String(d.imported ?? 0) }));
                      }
                    }}
                    disabled={busy || !csvText.trim()}
                    className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-paper hover:bg-accent-strong disabled:opacity-50"
                  >
                    {t("sell.csvImport")}
                  </button>
                </div>
              </div>
            )}
            {products.length === 0 ? (
              <p className="mt-4 text-center text-[12px] text-ink-soft">{t("sell.noProducts")}</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => {
                  const camp = campaignFor(p.id);
                  const low = p.stock <= 3;
                  const editing = editId === p.id;
                  return (
                    <div key={p.id} className="group overflow-hidden rounded-lg border border-line bg-paper">
                      {/* Product photo */}
                      <div className="relative h-28 bg-card">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                        ) : (
                          <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-ink-soft transition-colors hover:text-accent">
                            <ImagePlus className="h-5 w-5" />
                            <span className="text-[10px]">{t("sell.addPhoto")}</span>
                            <input
                              type="file" accept="image/*" className="sr-only"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const img = await fileToProductImage(f);
                                post({ action: "updateProduct", productId: p.id, image: img });
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                        {camp && (
                          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-paper">
                            −{camp.pctOff}%
                          </span>
                        )}
                        {low && (
                          <span className="absolute right-2 top-2 rounded-full bg-warn px-2 py-0.5 text-[10px] font-bold text-paper">
                            {t("sell.lowStock")}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="truncate text-[13px] font-medium" title={p.title}>{p.title}</div>
                        <div className="mt-0.5 flex items-center justify-between text-[12px]">
                          <span>
                            {camp ? (
                              <>
                                <span className="mr-1.5 text-ink-soft line-through">{usd(p.priceCents)}</span>
                                <span className="font-semibold text-accent-strong">{usd(Math.round(p.priceCents * (100 - camp.pctOff) / 100))}</span>
                              </>
                            ) : (
                              <span className="font-semibold">{usd(p.priceCents)}</span>
                            )}
                          </span>
                          <span className="text-[11px] text-ink-soft">×{p.stock}</span>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          <button
                            onClick={() => {
                              setEditId(editing ? null : p.id);
                              setEditPrice((p.priceCents / 100).toFixed(2));
                              setEditStock(String(p.stock));
                            }}
                            className="flex-1 rounded-md border border-line py-1 text-[11px] font-medium text-ink-soft hover:border-accent hover:text-accent-strong"
                          >
                            {t("sell.edit")}
                          </button>
                          <button
                            onClick={() => post({ action: "removeProduct", productId: p.id })}
                            className="rounded-md border border-line px-2 py-1 text-ink-soft transition-colors hover:border-danger hover:text-danger"
                            title={t("sell.remove")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {editing && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <input
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              type="number" min={0.01} step="0.01" placeholder="$"
                              className="w-16 rounded-md border border-line bg-card px-2 py-1 text-[11px] outline-none focus:border-accent"
                            />
                            <input
                              value={editStock}
                              onChange={(e) => setEditStock(e.target.value)}
                              type="number" min={0} placeholder={t("sell.stockPh")}
                              className="w-14 rounded-md border border-line bg-card px-2 py-1 text-[11px] outline-none focus:border-accent"
                            />
                            <button
                              onClick={async () => {
                                await post({ action: "updateProduct", productId: p.id, priceUsd: Number(editPrice), stock: Number(editStock) });
                                setEditId(null);
                              }}
                              disabled={busy}
                              className="flex-1 rounded-md bg-accent py-1 text-[11px] font-medium text-paper disabled:opacity-50"
                            >
                              {t("sell.save")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Campaigns */}
          <div className="rounded-xl border border-line bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
                <Tag className="h-4 w-4 text-accent" /> {t("sell.campaigns")}
              </h3>
              <button
                onClick={() => setShowCampaign((s) => !s)}
                className="rounded-md border border-line px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
              >
                {t("sell.newCampaign")}
              </button>
            </div>
            <p className="text-[11px] text-ink-soft">{t("sell.campaignHint")}</p>
            {showCampaign && (
              <div className="mt-3 space-y-2 rounded-lg border border-line bg-paper p-3">
                <div className="flex gap-2">
                  <input
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder={t("sell.campaignName")}
                    className="flex-1 rounded-md border border-line bg-card px-3 py-2 text-[13px] outline-none focus:border-accent"
                  />
                  <input
                    value={cPct}
                    onChange={(e) => setCPct(e.target.value)}
                    type="number" min={1} max={70} placeholder="% off"
                    className="w-20 rounded-md border border-line bg-card px-3 py-2 text-[13px] outline-none focus:border-accent"
                  />
                  <input
                    value={cDays}
                    onChange={(e) => setCDays(e.target.value)}
                    type="number" min={1} max={90} placeholder={t("sell.campaignDays")}
                    className="w-20 rounded-md border border-line bg-card px-3 py-2 text-[13px] outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={cProduct}
                    onChange={(e) => setCProduct(e.target.value)}
                    className="flex-1 rounded-md border border-line bg-card px-3 py-2 text-[13px] outline-none focus:border-accent"
                  >
                    <option value="">{t("sell.campaignAll")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      const d = await post({
                        action: "addCampaign",
                        name: cName,
                        pctOff: Number(cPct),
                        productId: cProduct || undefined,
                        days: cDays ? Number(cDays) : undefined,
                      });
                      if (d) {
                        setCName(""); setCPct(""); setCProduct(""); setCDays("");
                        setShowCampaign(false);
                        setNotice(t("sell.campaignOn"));
                      }
                    }}
                    disabled={busy || !cName.trim() || !cPct}
                    className="rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-paper disabled:opacity-50"
                  >
                    {t("sell.launch")}
                  </button>
                </div>
              </div>
            )}
            {!(campaigns ?? []).length ? (
              <p className="mt-3 text-[12px] text-ink-soft">{t("sell.noCampaigns")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line/60">
                {(campaigns ?? []).map((c) => {
                  const live = c.active && (!c.endsAt || new Date(c.endsAt).getTime() > data.fetchedAt);
                  const product = c.productId ? products.find((p) => p.id === c.productId) : null;
                  return (
                    <li key={c.id} className="flex items-center justify-between py-2 text-[13px]">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {c.name} <span className="text-accent-strong">−{c.pctOff}%</span>
                        </div>
                        <div className="text-[11px] text-ink-soft">
                          {product ? product.title : t("sell.campaignAll")} ·{" "}
                          {c.endsAt ? `${t("sell.until")} ${new Date(c.endsAt).toLocaleDateString()}` : t("sell.openEnded")}
                        </div>
                      </div>
                      <span className="ml-3 flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${live ? "bg-ok/15 text-ok" : "bg-line/40 text-ink-soft"}`}>
                          {live ? t("sell.live") : t("sell.ended")}
                        </span>
                        {live && (
                          <button
                            onClick={() => post({ action: "endCampaign", campaignId: c.id })}
                            className="text-[11px] font-medium text-ink-soft hover:text-danger"
                          >
                            {t("sell.end")}
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {view === "orders" && (
        <div className="space-y-5">
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
                        <div className="font-semibold text-ok">
                          {usd(s.agreedCents)}
                          {s.listCents && s.listCents > s.agreedCents && (
                            <span className="ml-1.5 text-[10px] font-normal text-ink-soft line-through">
                              {usd(s.listCents)}
                            </span>
                          )}
                        </div>
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

          {/* Interested buyers */}
          <div className="rounded-xl border border-line bg-card p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-accent" /> {t("sell.leads")}
            </h3>
            {!leads?.length ? (
              <p className="mt-3 text-[12px] text-ink-soft">{t("sell.noLeads")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line/60">
                {leads.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{l.productTitle}</div>
                      <div className="text-[11px] text-ink-soft">
                        {l.buyerLabel ?? "agent buyer"} · {new Date(l.at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[12px]">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        l.kind === "walk" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"
                      }`}>
                        {t(EV_KEY[l.kind as keyof typeof EV_KEY] ?? "sell.ev.offer")}
                      </span>
                      {(l.counterCents ?? l.offerCents) != null && (
                        <span className="font-semibold">{usd((l.counterCents ?? l.offerCents)!)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Agent activity */}
          <div className="rounded-xl border border-line bg-card p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
              <Handshake className="h-4 w-4 text-accent" /> {t("sell.activity")}
            </h3>
            {!events?.length ? (
              <p className="mt-3 text-[12px] text-ink-soft">{t("sell.noActivity")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line/60">
                {events.map((e) => (
                  <li key={e.id} className="py-2 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                          e.kind === "accept" ? "text-ok" : e.kind === "walk" ? "text-danger" : e.kind === "counter" ? "text-accent" : "text-ink-soft"
                        }`}>
                          {t(EV_KEY[e.kind as keyof typeof EV_KEY] ?? "sell.ev.offer")}
                        </span>
                        <div className="truncate font-medium">{e.productTitle}</div>
                        <div className="text-[11px] text-ink-soft">
                          {e.buyerLabel ?? "agent buyer"} · {new Date(e.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[12px]">
                        {e.offerCents != null && <div className="text-ink-soft">{usd(e.offerCents)}</div>}
                        {e.counterCents != null && <div className="font-semibold">{usd(e.counterCents)}</div>}
                      </div>
                    </div>
                    {e.message && <div className="mt-0.5 truncate text-[11px] italic text-ink-soft">“{e.message}”</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The merchant copilot — a chat over the seller's own numbers, with tools
 *  that can launch campaigns and adjust the catalog. */
function SellerCopilot({ onAction }: { onAction: () => void }) {
  const { t } = usePrefs();
  const { messages, sendMessage, status, error } = useChat({ transport: sellerTransport });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  const suggestions = [
    t("sell.ai.q1"),
    t("sell.ai.q2"),
    t("sell.ai.q3"),
    t("sell.ai.q4"),
  ];

  return (
    <div className="flex h-[560px] flex-col rounded-xl border border-line bg-card">
      <div className="border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-accent" /> {t("sell.ai.title")}
        </h3>
        <p className="text-[11px] text-ink-soft">{t("sell.ai.sub")}</p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Sparkles className="h-8 w-8 text-accent/40" />
            <p className="max-w-xs text-[12px] text-ink-soft">{t("sell.ai.empty")}</p>
            <div className="flex max-w-sm flex-wrap justify-center gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage({ text: s })}
                  className="rounded-full border border-line px-3 py-1.5 text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent-strong"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
                isUser ? "bg-accent text-paper" : "border border-line bg-paper"
              }`}>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return isUser ? (
                      <span key={i}>{part.text}</span>
                    ) : (
                      <Markdown key={i}>{part.text}</Markdown>
                    );
                  }
                  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                    const p = part as { type: string; toolName?: string; state?: string };
                    return (
                      <span key={i} className="my-1 flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent-strong">
                        <Wrench className="h-3 w-3" />
                        {p.toolName ?? p.type}
                        {p.state === "output-available" ? " ✓" : " …"}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-3.5 py-2.5 text-[12px] text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("sell.ai.thinking")}
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            {String(error)}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const txt = input.trim();
          if (!txt || busy) return;
          setInput("");
          sendMessage({ text: txt });
          onAction();
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("sell.ai.ph")}
          className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-accent px-3.5 py-2 text-paper hover:bg-accent-strong disabled:opacity-50"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

