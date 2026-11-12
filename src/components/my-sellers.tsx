"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, MessageSquare, Star, Store, Tag, X } from "lucide-react";
import { usePrefs } from "./preferences";

interface Offer {
  id: string;
  productTitle: string;
  priceCents: number;
  listCents: number | null;
  note: string | null;
  status: string;
  counterpart: string;
  expiresAt: string | null;
}
interface Seller {
  sellerUserId: string;
  displayName: string;
  orders: number;
  spentCents: number;
  lastAt: string | null;
  pendingReview: { orderId: string; title: string; amountCents: number }[];
  myRatings: { orderId: string; rating: number }[];
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

/** The buyer's relationship view — sellers they've dealt with, pending
 * offers to act on, and the review prompts that close the loop. */
export function MySellers() {
  const { t } = usePrefs();
  const [sellers, setSellers] = useState<Seller[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [rateFor, setRateFor] = useState<{ seller: Seller; orderId: string; title: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/my-sellers").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSellers(d.sellers ?? []));
    fetch("/api/offers").then((r) => (r.ok ? r.json() : null)).then((d) => d && setOffers(d.offers ?? []));
  }, []);
  useEffect(load, [load]);

  const actOffer = async (offerId: string, action: "accept" | "decline") => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, offerId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error ?? t("common.error"));
      else {
        if (d.approveUrl) window.open(d.approveUrl, "_blank", "noopener");
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!rateFor) return;
    setBusy(true);
    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: rateFor.orderId,
          sellerUserId: rateFor.seller.sellerUserId,
          rating,
          comment: comment || undefined,
        }),
      });
      if (r.ok) {
        setRateFor(null); setComment(""); setRating(5);
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? t("common.error"));
      }
    } finally {
      setBusy(false);
    }
  };

  const openOffers = offers.filter((o) => o.status === "open");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</div>
      )}

      {/* Pending offers — the seller reached out, the buyer decides */}
      {openOffers.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
            <Tag className="h-4 w-4 text-accent" /> {t("ms.offers")}
          </h3>
          <div className="space-y-3">
            {openOffers.map((o) => (
              <div key={o.id} className="rounded-xl border border-accent/40 bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{o.productTitle}</div>
                    <div className="text-[11px] text-ink-soft">{o.counterpart}</div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="font-semibold text-accent-strong">{usd(o.priceCents)}</div>
                    {o.listCents && o.listCents > o.priceCents && (
                      <div className="text-[11px] text-ink-soft line-through">{usd(o.listCents)}</div>
                    )}
                  </div>
                </div>
                {o.note && <p className="mt-1.5 text-[12px] text-ink-soft">&ldquo;{o.note}&rdquo;</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => actOffer(o.id, "accept")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-paper hover:bg-accent-strong disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> {t("ms.accept")}
                  </button>
                  <button
                    onClick={() => actOffer(o.id, "decline")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-soft hover:text-ink disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> {t("ms.decline")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My sellers */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <Store className="h-4 w-4 text-accent" /> {t("ms.title")}
        </h3>
        {sellers === null ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-line/40" />)}
          </div>
        ) : sellers.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-8 text-center text-[12px] text-ink-soft">
            {t("ms.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {sellers.map((s) => (
              <div key={s.sellerUserId} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.displayName}</div>
                    <div className="mt-0.5 text-[11px] text-ink-soft">
                      {s.orders} {t("ms.orders")} · {usd(s.spentCents)} {t("ms.spent")}
                      {s.lastAt && ` · ${new Date(s.lastAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <Link
                    href="/messages"
                    className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-soft hover:text-ink"
                  >
                    <MessageSquare className="h-3 w-3" /> {t("cust.message")}
                  </Link>
                </div>
                {s.myRatings.length > 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i <= (s.myRatings[0]?.rating ?? 0) ? "fill-accent text-accent" : "text-line"}`}
                      />
                    ))}
                    <span className="ml-1 text-[10px] text-ink-soft">{t("ms.youRated")}</span>
                  </div>
                )}
                {s.pendingReview.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {s.pendingReview.map((pr) => (
                      <button
                        key={pr.orderId}
                        onClick={() => setRateFor({ seller: s, orderId: pr.orderId, title: pr.title })}
                        className="flex w-full items-center justify-between rounded-md border border-line/60 bg-paper px-3 py-1.5 text-left text-[12px] transition-colors hover:border-accent"
                      >
                        <span className="truncate">{pr.title}</span>
                        <span className="ml-2 flex shrink-0 items-center gap-1 text-accent-strong">
                          <Star className="h-3 w-3" /> {t("ms.rate")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Review composer */}
      {rateFor && (
        <div className="space-y-3 rounded-xl border border-accent/40 bg-accent-mist p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
            {t("ms.rateTitle")} — {rateFor.title}
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} onClick={() => setRating(i)}>
                <Star
                  className={`h-6 w-6 transition-colors ${i <= rating ? "fill-accent text-accent" : "text-line hover:text-accent"}`}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("ms.commentPh")}
            rows={2}
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={submitReview}
              disabled={busy}
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-paper disabled:opacity-50"
            >
              {t("ms.submit")}
            </button>
            <button
              onClick={() => setRateFor(null)}
              className="rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-soft"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
