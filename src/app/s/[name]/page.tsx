import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { BadgeCheck, Bot, Package, ShieldCheck, Star } from "lucide-react";
import { ensureDb, getDb } from "@/lib/db";
import {
  merchantProfiles,
  merchantSales,
  sellerProducts,
  sellerReviews,
  users,
  vendorScores,
} from "@/lib/db/schema";
import { activeCampaignsMap, promoPriceCents } from "@/lib/campaigns";
import { Logo } from "@/components/brand";

/* Public storefront — the seller's catalog + reputation, no login required.
 * Matches the landing's fixed dark palette. The margin floor is never shown:
 * buyers see prices the agent advertises, not what it will accept. */
const BG = "bg-[#060a09]";
const CARD = "bg-[#0c1210]";
const LINE = "border-white/[0.08]";
const INK = "text-[#e8efec]";
const SOFT = "text-[#8fa3a0]";
const TEAL = "text-[#2dd4bf]";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function Storefront({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  await ensureDb();
  const db = getDb();

  const profiles = await db.select().from(merchantProfiles).limit(200);
  const profile = profiles.find((p) => slugify(p.displayName) === name.toLowerCase());
  if (!profile) notFound();

  const [products, reviews, sales, [score]] = await Promise.all([
    db
      .select()
      .from(sellerProducts)
      .where(eq(sellerProducts.userId, profile.userId))
      .orderBy(sellerProducts.title)
      .limit(60),
    db
      .select({
        rating: sellerReviews.rating,
        comment: sellerReviews.comment,
        createdAt: sellerReviews.createdAt,
        buyer: users.username,
      })
      .from(sellerReviews)
      .leftJoin(users, eq(sellerReviews.buyerUserId, users.id))
      .where(eq(sellerReviews.sellerUserId, profile.userId))
      .orderBy(desc(sellerReviews.createdAt))
      .limit(12),
    db
      .select({ id: merchantSales.id })
      .from(merchantSales)
      .where(eq(merchantSales.sellerUserId, profile.userId))
      .limit(500),
    db.select().from(vendorScores).where(eq(vendorScores.domain, profile.displayName)).limit(1),
  ]);
  const campaigns = await activeCampaignsMap(profile.userId);

  const rated = reviews.filter((r) => r.rating > 0);
  const avgRating = rated.length
    ? rated.reduce((a, r) => a + r.rating, 0) / rated.length
    : null;
  const priceFor = (p: (typeof products)[number]) => {
    const c = campaigns.byProduct.get(p.id) ?? campaigns.global;
    return c
      ? { price: promoPriceCents(p.priceCents, c.pctOff), list: p.priceCents, promo: c.name }
      : { price: p.priceCents, list: null, promo: null };
  };

  return (
    <div className={`min-h-screen ${BG} ${INK}`}>
      <header className={`border-b ${LINE} ${BG}/80 backdrop-blur-xl`}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-6 w-6 text-[#2dd4bf]" />
            <span className="font-display text-[15px] font-semibold tracking-tight">Parley</span>
          </Link>
          <span className={`ml-auto flex items-center gap-1.5 text-[12px] ${SOFT}`}>
            <Bot className="h-3.5 w-3.5" /> Prices negotiated by an AI agent
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        {/* ── Store header ─────────────────────────────── */}
        <div className={`rounded-2xl border ${LINE} ${CARD} p-6 md:p-8`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  {profile.displayName}
                </h1>
                <BadgeCheck className={`h-5 w-5 ${TEAL}`} />
              </div>
              <p className={`mt-1 text-[13px] ${SOFT}`}>
                Sells on Parley — every order negotiates with this store&apos;s agent and pays
                through PayPal escrow.
              </p>
            </div>
            <div className="flex items-center gap-5 text-center">
              {avgRating != null && (
                <div>
                  <div className="flex items-center gap-1 font-display text-xl font-semibold">
                    <Star className="h-4 w-4 fill-[#fbbf24] text-[#fbbf24]" />
                    {avgRating.toFixed(1)}
                  </div>
                  <p className={`text-[11px] ${SOFT}`}>{rated.length} reviews</p>
                </div>
              )}
              <div>
                <div className="font-display text-xl font-semibold">{sales.length}</div>
                <p className={`text-[11px] ${SOFT}`}>agent-closed sales</p>
              </div>
              {score && (
                <div>
                  <div className={`font-display text-xl font-semibold ${TEAL}`}>{score.score}</div>
                  <p className={`text-[11px] ${SOFT}`}>vendor score</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Catalog ──────────────────────────────────── */}
        <h2 className="mb-4 mt-10 flex items-center gap-2 font-display text-lg font-semibold">
          <Package className="h-4.5 w-4.5" /> Catalog
          <span className={`text-[12px] font-normal ${SOFT}`}>
            — sticker prices; agents negotiate from here
          </span>
        </h2>
        {products.length === 0 ? (
          <p className={`rounded-xl border ${LINE} ${CARD} p-6 text-[13px] ${SOFT}`}>
            This store hasn&apos;t published products yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const pr = priceFor(p);
              return (
                <div key={p.id} className={`overflow-hidden rounded-xl border ${LINE} ${CARD}`}>
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-supplied data/https URL
                    <img src={p.image} alt={p.title} className="h-36 w-full object-cover" />
                  )}
                  <div className="p-4">
                    <p className="text-[14px] font-medium leading-snug">{p.title}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-display text-lg font-semibold">{usd(pr.price)}</span>
                      {pr.list != null && (
                        <span className={`text-[12px] line-through ${SOFT}`}>{usd(pr.list)}</span>
                      )}
                      {pr.promo && (
                        <span className={`rounded-full bg-[#2dd4bf]/10 px-2 py-0.5 text-[10px] font-medium ${TEAL}`}>
                          {pr.promo}
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-[11px] ${SOFT}`}>
                      {p.stock > 0 ? `${p.stock} in stock` : "out of stock"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Reviews ──────────────────────────────────── */}
        {reviews.length > 0 && (
          <>
            <h2 className="mb-4 mt-10 font-display text-lg font-semibold">Buyer reviews</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {reviews.map((r, i) => (
                <div key={i} className={`rounded-xl border ${LINE} ${CARD} p-4`}>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${s < r.rating ? "fill-[#fbbf24] text-[#fbbf24]" : SOFT}`}
                      />
                    ))}
                    <span className={`ml-2 text-[11px] ${SOFT}`}>
                      {r.buyer ?? "buyer"} ·{" "}
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  {r.comment && <p className="mt-2 text-[13px] leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CTA ──────────────────────────────────────── */}
        <div className={`mt-12 flex flex-col items-center gap-3 rounded-2xl border ${LINE} ${CARD} p-8 text-center`}>
          <ShieldCheck className={`h-6 w-6 ${TEAL}`} />
          <p className="max-w-md text-[14px] leading-relaxed">
            Buying from {profile.displayName}? Your agent negotiates the price and PayPal holds
            the money until the goods arrive.
          </p>
          <Link
            href="/login"
            className="rounded-lg bg-[#2dd4bf] px-5 py-2 text-[13px] font-semibold text-[#06211d] transition hover:bg-[#5eead4]"
          >
            Shop with your agent →
          </Link>
        </div>
      </main>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  await ensureDb();
  const profiles = await getDb().select().from(merchantProfiles).limit(200);
  const profile = profiles.find((p) => slugify(p.displayName) === name.toLowerCase());
  return {
    title: profile ? `${profile.displayName} — Parley store` : "Parley store",
    description: profile
      ? `${profile.displayName} sells on Parley — prices negotiated by an AI agent, paid through PayPal escrow.`
      : "A store on Parley.",
  };
}
