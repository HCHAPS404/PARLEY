import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { merchantProfiles, merchantSales, sellerCampaigns, sellerEvents, sellerProducts, sellerReviews } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { buyerUserForLabel } from "@/lib/relationships";
import { audit } from "@/lib/audit";

export const maxDuration = 30;

/** Product photos: data URLs (resized client-side) or https — nothing else. */
function cleanImage(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (s.startsWith("data:image/") && s.length < 400_000) return s;
  if (s.startsWith("https://") && s.length < 2000) return s;
  return null;
}

/** Seller-side state: my merchant profile, my catalog, my agent's sales. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const db = getDb();
  const [profile] = await db
    .select()
    .from(merchantProfiles)
    .where(eq(merchantProfiles.userId, user.id))
    .limit(1);
  const products = await db
    .select()
    .from(sellerProducts)
    .where(eq(sellerProducts.userId, user.id))
    .orderBy(desc(sellerProducts.createdAt))
    .limit(50);
  const sales = await db
    .select()
    .from(merchantSales)
    .where(eq(merchantSales.sellerUserId, user.id))
    .orderBy(desc(merchantSales.createdAt))
    .limit(50);
  const events = await db
    .select()
    .from(sellerEvents)
    .where(eq(sellerEvents.sellerUserId, user.id))
    .orderBy(desc(sellerEvents.createdAt))
    .limit(300);

  // Leads — a buyer who negotiated but never closed is a warm prospect. Events
  // arrive newest-first, so the first event per (buyer, product) is the latest
  // state of that conversation; anything that isn't 'accept' is still open.
  const seen = new Set<string>();
  const leads = [];
  for (const e of events) {
    const key = `${e.buyerLabel ?? "?"}|${e.productTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.kind === "accept") continue;
    leads.push({
      buyerLabel: e.buyerLabel,
      productTitle: e.productTitle,
      kind: e.kind,
      offerCents: e.offerCents,
      counterCents: e.counterCents,
      at: e.createdAt,
    });
    if (leads.length >= 10) break;
  }

  // Conversion — of the threads the agent touched, how many closed.
  const threadCount = seen.size;
  const conversionPct =
    threadCount > 0 ? Math.round((sales.length / threadCount) * 100) : 0;
  const avgSaleCents = sales.length
    ? Math.round(sales.reduce((s, x) => s + x.agreedCents, 0) / sales.length)
    : 0;

  // Negotiation funnel — how offers turned into revenue.
  const funnel = { offers: 0, counters: 0, accepts: 0, walks: 0 };
  for (const e of events) {
    if (e.kind === "offer") funnel.offers++;
    else if (e.kind === "counter") funnel.counters++;
    else if (e.kind === "accept") funnel.accepts++;
    else if (e.kind === "walk") funnel.walks++;
  }

  // Average discount the agent conceded vs list price at close.
  const discounted = sales.filter((s) => s.listCents && s.listCents > s.agreedCents);
  const avgDiscountPct = discounted.length
    ? Math.round(
        (discounted.reduce((s, x) => s + (1 - x.agreedCents / x.listCents!), 0) /
          discounted.length) * 100,
      )
    : 0;

  // Top products by negotiated revenue.
  const byProduct = new Map<string, { revenueCents: number; units: number }>();
  for (const s of sales) {
    const cur = byProduct.get(s.productTitle) ?? { revenueCents: 0, units: 0 };
    cur.revenueCents += s.agreedCents;
    cur.units++;
    byProduct.set(s.productTitle, cur);
  }
  const topProducts = [...byProduct.entries()]
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5);

  const campaigns = await db
    .select()
    .from(sellerCampaigns)
    .where(eq(sellerCampaigns.userId, user.id))
    .orderBy(desc(sellerCampaigns.createdAt))
    .limit(20);

  const lowStock = products.filter((p) => p.stock <= 3);
  const pendingShip = sales.filter((s) => s.status === "agreed" || s.status === "invoiced");
  const revenueCents = sales.reduce((s, x) => s + x.agreedCents, 0);

  // Customers — the relationship ledger aggregated per buyer label: deals,
  // lifetime spend, last touch, and whether a lead is still warm (their latest
  // event isn't an accept). Parley buyers resolve to real users so the seller
  // can send them targeted offers and open a thread.
  const custMap = new Map<
    string,
    { deals: number; spentCents: number; lastAt: Date | null; lastKind: string }
  >();
  for (const s of sales) {
    if (!s.buyerLabel) continue;
    const c = custMap.get(s.buyerLabel) ?? { deals: 0, spentCents: 0, lastAt: null, lastKind: "accept" };
    c.deals++;
    c.spentCents += s.agreedCents;
    c.lastAt = s.createdAt;
    c.lastKind = "accept";
    custMap.set(s.buyerLabel, c);
  }
  for (const e of events) {
    if (!e.buyerLabel) continue;
    const c = custMap.get(e.buyerLabel) ?? { deals: 0, spentCents: 0, lastAt: null, lastKind: e.kind };
    if (!c.lastAt || (e.createdAt && e.createdAt > c.lastAt)) {
      c.lastAt = e.createdAt;
      c.lastKind = e.kind;
    }
    custMap.set(e.buyerLabel, c);
  }
  const customers = await Promise.all(
    [...custMap.entries()].map(async ([label, c]) => {
      const u = await buyerUserForLabel(label);
      return {
        label,
        buyerUserId: u?.id ?? null,
        username: u?.username ?? null,
        deals: c.deals,
        spentCents: c.spentCents,
        lastAt: c.lastAt,
        lastKind: c.lastKind,
        openLead: c.lastKind !== "accept" && c.deals === 0,
      };
    }),
  );
  customers.sort((a, b) => b.spentCents - a.spentCents);

  const reviewRows = await db
    .select({ n: sql<number>`count(*)`, avg: sql<number>`avg(rating)` })
    .from(sellerReviews)
    .where(eq(sellerReviews.sellerUserId, user.id));

  return NextResponse.json({
    profile: profile ?? null,
    products,
    sales,
    events: events.slice(0, 30),
    leads,
    campaigns,
    customers: customers.slice(0, 20),
    rating: {
      count: Number(reviewRows[0]?.n ?? 0),
      avg: Number(reviewRows[0]?.avg ?? 0),
    },
    stats: {
      threads: threadCount,
      conversionPct,
      avgSaleCents,
      avgDiscountPct,
      revenueCents,
      funnel,
      topProducts,
      lowStockCount: lowStock.length,
      pendingShipCount: pendingShip.length,
    },
  });
}

/** Configure the merchant agent and stock the catalog. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    action?: string;
    displayName?: string;
    floorRatioPct?: number;
    style?: string;
    title?: string;
    priceUsd?: number;
    stock?: number;
    productId?: string;
    saleId?: string;
    trackingNumber?: string;
    carrier?: string;
    csv?: string;
    name?: string;
    pctOff?: number;
    days?: number;
    campaignId?: string;
    image?: string;
  };
  await ensureDb();
  const db = getDb();

  if (body.action === "profile") {
    const displayName = String(body.displayName ?? "").trim().slice(0, 80);
    if (!displayName) return NextResponse.json({ error: "displayName required" }, { status: 400 });
    const floorRatioPct = Math.min(95, Math.max(50, Math.round(Number(body.floorRatioPct) || 85)));
    const style = ["aggressive", "balanced", "conservative"].includes(body.style ?? "")
      ? body.style!
      : "balanced";
    const [existing] = await db
      .select()
      .from(merchantProfiles)
      .where(eq(merchantProfiles.userId, user.id))
      .limit(1);
    const id = existing?.id ?? `merch_${crypto.randomUUID().slice(0, 8)}`;
    if (existing) {
      await db
        .update(merchantProfiles)
        .set({ displayName, floorRatioPct, style })
        .where(eq(merchantProfiles.id, id));
    } else {
      await db.insert(merchantProfiles).values({ id, userId: user.id, displayName, floorRatioPct, style });
    }
    await audit({
      actor: "user", action: "seller_profile_set",
      userId: user.id, input: { displayName, floorRatioPct, style },
      rationale: "Configure the user's merchant agent — floor and negotiation style",
    });
    return NextResponse.json({ ok: true, id });
  }

  if (body.action === "addProduct") {
    const title = String(body.title ?? "").trim().slice(0, 120);
    const priceCents = Math.round(Number(body.priceUsd) * 100);
    if (!title || !Number.isInteger(priceCents) || priceCents <= 0)
      return NextResponse.json({ error: "title + positive priceUsd required" }, { status: 400 });
    const [profile] = await db
      .select()
      .from(merchantProfiles)
      .where(eq(merchantProfiles.userId, user.id))
      .limit(1);
    if (!profile) return NextResponse.json({ error: "Create your merchant profile first" }, { status: 400 });
    const id = `sp_${crypto.randomUUID().slice(0, 8)}`;
    const image = cleanImage(body.image);
    await db.insert(sellerProducts).values({
      id, userId: user.id, title, priceCents,
      stock: Math.max(0, Math.round(Number(body.stock) || 10)),
      ...(image ? { image } : {}),
    });
    return NextResponse.json({ ok: true, id });
  }

  if (body.action === "importCsv") {
    // Bulk catalog load — one "title,price[,stock]" per line, commas inside
    // titles unsupported (keep it honest and simple).
    const [profile] = await db
      .select()
      .from(merchantProfiles)
      .where(eq(merchantProfiles.userId, user.id))
      .limit(1);
    if (!profile) return NextResponse.json({ error: "Create your merchant profile first" }, { status: 400 });
    const lines = String(body.csv ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 100);
    const rows = lines
      .map((l) => l.split(",").map((c) => c.trim()))
      .map(([title, price, stock]) => ({
        title: (title ?? "").slice(0, 120),
        priceCents: Math.round(Number(price) * 100),
        stock: Math.max(0, Math.round(Number(stock) || 10)),
      }))
      .filter((r) => r.title && Number.isInteger(r.priceCents) && r.priceCents > 0);
    if (!rows.length)
      return NextResponse.json({ error: "No valid rows — use title,price[,stock] per line" }, { status: 400 });
    for (const r of rows) {
      await db.insert(sellerProducts).values({
        id: `sp_${crypto.randomUUID().slice(0, 8)}`,
        userId: user.id,
        title: r.title,
        priceCents: r.priceCents,
        stock: r.stock,
      });
    }
    await audit({
      actor: "user", action: "seller_catalog_import",
      userId: user.id,
      input: { rows: rows.length },
      rationale: "Bulk-load the seller catalog their agent negotiates from",
    });
    return NextResponse.json({ ok: true, imported: rows.length });
  }

  if (body.action === "ship") {
    // Seller fulfills — tracking propagates to the buyer's escrow order,
    // whose watchdog then watches the carrier until DELIVERED.
    const saleId = String(body.saleId ?? "");
    const trackingNumber = String(body.trackingNumber ?? "").trim();
    const carrier = String(body.carrier ?? "").toUpperCase().replace(/\s+/g, "_");
    if (!trackingNumber || !carrier)
      return NextResponse.json({ error: "trackingNumber + carrier required" }, { status: 400 });
    const [sale] = await db
      .select()
      .from(merchantSales)
      .where(eq(merchantSales.id, saleId))
      .limit(1);
    if (!sale || sale.sellerUserId !== user.id)
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    await db
      .update(merchantSales)
      .set({ trackingNumber, carrier, status: "shipped" })
      .where(eq(merchantSales.id, saleId));
    if (sale.buyerOrderId) {
      await db.execute(sql`
        update orders_local set tracking_number = ${trackingNumber}, carrier = ${carrier},
          tracking_status = 'SHIPPED', updated_at = now()
        where paypal_order_id = ${sale.buyerOrderId}`);
    }
    await audit({
      actor: "user", action: "seller_shipped",
      userId: user.id,
      input: { saleId, trackingNumber, carrier, buyerOrderId: sale.buyerOrderId },
      rationale: "Seller shipped — tracking flows into the buyer's escrow watch",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "addCampaign") {
    const name = String(body.name ?? "").trim().slice(0, 80);
    const pctOff = Math.min(70, Math.max(1, Math.round(Number(body.pctOff) || 0)));
    if (!name || !pctOff)
      return NextResponse.json({ error: "name + pctOff (1–70) required" }, { status: 400 });
    const days = Math.min(90, Math.max(0, Math.round(Number(body.days) || 0)));
    const id = `camp_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(sellerCampaigns).values({
      id,
      userId: user.id,
      name,
      pctOff,
      productId: body.productId ? String(body.productId) : null,
      endsAt: days > 0 ? new Date(Date.now() + days * 86_400_000) : null,
    });
    await audit({
      actor: "user", action: "seller_campaign_start",
      userId: user.id,
      input: { name, pctOff, productId: body.productId ?? null, days },
      rationale: "Seller launched a promotion — their agent advertises the promo price and floors at it",
    });
    return NextResponse.json({ ok: true, id });
  }

  if (body.action === "endCampaign") {
    await db
      .update(sellerCampaigns)
      .set({ active: false })
      .where(eq(sellerCampaigns.id, String(body.campaignId)));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "updateProduct") {
    const priceUsd = Number(body.priceUsd);
    const stock = Math.round(Number(body.stock));
    const fields: Partial<{ priceCents: number; stock: number; image: string | null }> = {};
    const image = cleanImage(body.image);
    if (body.image !== undefined) fields.image = image;
    if (Number.isFinite(priceUsd) && priceUsd > 0) fields.priceCents = Math.round(priceUsd * 100);
    if (Number.isInteger(stock) && stock >= 0) fields.stock = stock;
    if (!Object.keys(fields).length)
      return NextResponse.json({ error: "priceUsd and/or stock required" }, { status: 400 });
    await db
      .update(sellerProducts)
      .set(fields)
      .where(eq(sellerProducts.id, String(body.productId)));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "removeProduct") {
    await db
      .delete(sellerProducts)
      .where(eq(sellerProducts.id, String(body.productId)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
