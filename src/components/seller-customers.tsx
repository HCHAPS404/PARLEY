"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Send, Star, Tag, Users } from "lucide-react";
import { usePrefs } from "./preferences";

interface Customer {
  label: string;
  buyerUserId: string | null;
  username: string | null;
  deals: number;
  spentCents: number;
  lastAt: string | null;
  lastKind: string;
  openLead: boolean;
}
interface Product {
  id: string;
  title: string;
  priceCents: number;
  stock: number;
}
interface Offer {
  id: string;
  productTitle: string;
  priceCents: number;
  status: string;
  counterpart: string;
  createdAt: string;
}
interface Review {
  id: string;
  rating: number;
  comment: string | null;
  counterpart: string;
  createdAt: string;
}
interface Data {
  customers?: Customer[];
  products?: Product[];
  rating?: { count: number; avg: number };
}
interface OfferRow {
  offers?: Offer[];
}
interface ReviewData {
  reviews?: Review[];
  summary?: { count: number; avg: number } | null;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Seller CRM — the relationship ledger: who bought, how much, how warm the
 * lead is, plus the actions that close the loop (message, targeted offer). */
export function SellerCustomers() {
  const { t } = usePrefs();
  const [data, setData] = useState<Data | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{ count: number; avg: number } | null>(null);
  const [offerFor, setOfferFor] = useState<Customer | null>(null);
  const [offerProduct, setOfferProduct] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/seller").then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d));
    fetch("/api/offers").then((r) => (r.ok ? r.json() : null)).then((d: OfferRow | null) => d && setOffers(d.offers ?? []));
    fetch("/api/reviews").then((r) => (r.ok ? r.json() : null)).then((d: ReviewData | null) => {
      if (d) { setReviews(d.reviews ?? []); setSummary(d.summary ?? null); }
    });
  }, []);
  useEffect(load, [load]);

  const sendOffer = async () => {
    if (!offerFor?.buyerUserId || !offerProduct || !offerPrice) return;
    setBusy(true);
    try {
      const r = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          buyerUserId: offerFor.buyerUserId,
          productId: offerProduct,
          priceUsd: Number(offerPrice),
          note: offerNote || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      setNotice(r.ok ? null : (d.error ?? "Error"));
      if (r.ok) {
        setOfferFor(null);
        setOfferPrice(""); setOfferNote(""); setOfferProduct("");
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const customers = data?.customers ?? [];
  const products = data?.products ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Reputation card */}
      {summary && summary.count > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i <= Math.round(summary.avg) ? "fill-accent text-accent" : "text-line"}`}
              />
            ))}
          </div>
          <div>
            <span className="font-semibold">{summary.avg.toFixed(1)}</span>
            <span className="ml-1 text-[12px] text-ink-soft">
              {t("cust.ratingFrom").replace("{n}", String(summary.count))}
            </span>
          </div>
        </div>
      )}

      {/* Customers */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <Users className="h-4 w-4 text-accent" /> {t("cust.title")}
        </h3>
        {customers.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-8 text-center text-[12px] text-ink-soft">
            {t("cust.empty")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {customers.map((c) => (
              <div key={c.label} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {c.username ?? c.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-soft">
                      {c.deals} {t("cust.deals")} · {usd(c.spentCents)} {t("cust.spent")}
                    </div>
                  </div>
                  {c.openLead ? (
                    <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warn">
                      {t("cust.lead")}
                    </span>
                  ) : c.deals > 0 ? (
                    <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-ok">
                      {c.deals > 1 ? t("cust.repeat") : t("cust.customer")}
                    </span>
                  ) : null}
                </div>
                {c.buyerUserId && (
                  <div className="mt-3 flex gap-2">
                    <Link
                      href="/messages"
                      className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-soft transition-colors hover:text-ink"
                    >
                      <MessageSquare className="h-3 w-3" /> {t("cust.message")}
                    </Link>
                    <button
                      onClick={() => {
                        setOfferFor(c);
                        setOfferProduct(products[0]?.id ?? "");
                      }}
                      className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-medium text-paper transition-colors hover:bg-accent-strong"
                    >
                      <Tag className="h-3 w-3" /> {t("cust.sendOffer")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Offer composer */}
      {offerFor && (
        <div className="space-y-3 rounded-xl border border-accent/40 bg-accent-mist p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
            {t("cust.offerTo")} {offerFor.username ?? offerFor.label}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={offerProduct}
              onChange={(e) => setOfferProduct(e.target.value)}
              className="rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {usd(p.priceCents)}
                </option>
              ))}
            </select>
            <input
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              placeholder={t("cust.offerPrice")}
              type="number" min="0.01" step="0.01"
              className="rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
            <input
              value={offerNote}
              onChange={(e) => setOfferNote(e.target.value)}
              placeholder={t("cust.offerNote")}
              className="rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </div>
          {notice && <div className="text-[12px] text-danger">{notice}</div>}
          <div className="flex gap-2">
            <button
              onClick={sendOffer}
              disabled={busy || !offerProduct || !offerPrice}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-paper disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> {t("cust.send")}
            </button>
            <button
              onClick={() => { setOfferFor(null); setNotice(null); }}
              className="rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-soft"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Sent offers */}
      {offers.length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold">{t("cust.offers")}</h3>
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-card">
            {offers.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <span className="truncate font-medium">{o.productTitle}</span>
                  <span className="ml-2 text-[11px] text-ink-soft">→ {o.counterpart}</span>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{usd(o.priceCents)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      o.status === "accepted"
                        ? "bg-ok/15 text-ok"
                        : o.status === "open"
                          ? "bg-accent/15 text-accent-strong"
                          : "bg-line/40 text-ink-soft"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews received */}
      {reviews.length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold">{t("cust.reviews")}</h3>
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-card">
            {reviews.map((r) => (
              <div key={r.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`h-3 w-3 ${i <= r.rating ? "fill-accent text-accent" : "text-line"}`} />
                    ))}
                  </div>
                  <span className="text-[11px] text-ink-soft">{r.counterpart}</span>
                </div>
                {r.comment && <p className="mt-1 text-[12px] text-ink-soft">{r.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
