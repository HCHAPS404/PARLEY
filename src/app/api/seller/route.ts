import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { merchantProfiles, merchantSales, sellerEvents, sellerProducts } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const maxDuration = 30;

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

  return NextResponse.json({
    profile: profile ?? null,
    products,
    sales,
    events: events.slice(0, 30),
    leads,
    stats: { threads: threadCount, conversionPct, avgSaleCents },
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
    await db.insert(sellerProducts).values({
      id, userId: user.id, title, priceCents,
      stock: Math.max(0, Math.round(Number(body.stock) || 10)),
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

  if (body.action === "removeProduct") {
    await db
      .delete(sellerProducts)
      .where(eq(sellerProducts.id, String(body.productId)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
