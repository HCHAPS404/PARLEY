import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import {
  alerts,
  directOffers,
  merchantProfiles,
  merchantSales,
  ordersLocal,
  sellerProducts,
  spaces,
  users,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";
import { checkPolicy } from "@/lib/policy";
import { createEscrowOrder } from "@/lib/paypal";
import { ensureThread, postMessage } from "@/lib/relationships";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

async function spaceFor(userId: string) {
  const [s] = await getDb()
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.userId, userId))
    .limit(1);
  return s?.id ?? null;
}

const approveUrlFor = (orderId: string) =>
  `https://${env.paypalEnv === "live" ? "www.paypal.com" : "www.sandbox.paypal.com"}/checkoutnow?token=${orderId}`;

/**
 * Direct offers — the seller's win-back + loyalty channel.
 * GET: buyer sees offers addressed to them; seller sees offers they sent.
 * POST create (seller): {buyerLabel|buyerUserId, productId, priceUsd, note, days}
 * POST accept (buyer): {offerId} → real escrow order at the offered price.
 * POST decline (buyer): {offerId}
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const db = getDb();
  const asSeller = user.persona === "seller";
  const rows = await db
    .select()
    .from(directOffers)
    .where(
      asSeller
        ? eq(directOffers.sellerUserId, user.id)
        : eq(directOffers.buyerUserId, user.id),
    )
    .orderBy(desc(directOffers.createdAt))
    .limit(50);

  const offers = await Promise.all(
    rows.map(async (o) => {
      let counterpart: string;
      if (asSeller) {
        const [b] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, o.buyerUserId))
          .limit(1);
        counterpart = b?.username ?? "buyer";
      } else {
        const [mp] = await db
          .select({ displayName: merchantProfiles.displayName })
          .from(merchantProfiles)
          .where(eq(merchantProfiles.userId, o.sellerUserId))
          .limit(1);
        counterpart = mp?.displayName ?? "seller";
      }
      return { ...o, counterpart };
    }),
  );
  return NextResponse.json({ offers });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    action?: string;
    offerId?: string;
    buyerUserId?: string;
    productId?: string;
    priceUsd?: number;
    note?: string;
    days?: number;
  };
  await ensureDb();
  const db = getDb();

  // ── Seller sends a targeted offer ──────────────────────────────────────
  if (body.action === "create") {
    if (user.persona !== "seller")
      return NextResponse.json({ error: "Sellers only" }, { status: 403 });
    const productId = String(body.productId ?? "");
    const buyerUserId = String(body.buyerUserId ?? "");
    const priceCents = Math.round(Number(body.priceUsd) * 100);
    if (!buyerUserId || !productId || !Number.isInteger(priceCents) || priceCents <= 0)
      return NextResponse.json({ error: "buyerUserId + productId + positive priceUsd required" }, { status: 400 });
    const [product] = await db
      .select()
      .from(sellerProducts)
      .where(eq(sellerProducts.id, productId))
      .limit(1);
    if (!product || product.userId !== user.id)
      return NextResponse.json({ error: "Product not in your catalog" }, { status: 404 });
    // Never offer below the margin floor — the invariant holds here too.
    const [profile] = await db
      .select()
      .from(merchantProfiles)
      .where(eq(merchantProfiles.userId, user.id))
      .limit(1);
    const floor = Math.round((product.priceCents * (profile?.floorRatioPct ?? 85)) / 100);
    if (priceCents < floor)
      return NextResponse.json(
        { error: `Below your margin floor — minimum $${(floor / 100).toFixed(2)}` },
        { status: 400 },
      );
    const id = `off_${crypto.randomUUID().slice(0, 8)}`;
    const days = Math.min(30, Math.max(1, Math.round(Number(body.days) || 7)));
    await db.insert(directOffers).values({
      id,
      sellerUserId: user.id,
      buyerUserId,
      productId,
      productTitle: product.title,
      priceCents,
      listCents: product.priceCents,
      note: String(body.note ?? "").slice(0, 200) || null,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    });
    const bSpace = await spaceFor(buyerUserId);
    await db.insert(alerts).values({
      kind: "offer_received",
      spaceId: bSpace,
      payload: {
        offerId: id,
        title: `${profile?.displayName ?? "A seller"} sent you an offer`,
        priceUsd: priceCents / 100,
        reason: `"${product.title}" at $${(priceCents / 100).toFixed(2)}${body.note ? ` — "${String(body.note).slice(0, 120)}"` : ""}`,
      },
    });
    await audit({
      actor: "user", action: "direct_offer_sent", userId: user.id,
      input: { offerId: id, buyerUserId, productId, priceCents },
      rationale: "Seller sent a targeted offer — win-back or loyalty pricing",
    });
    return NextResponse.json({ ok: true, id });
  }

  // ── Buyer-side actions ─────────────────────────────────────────────────
  const offerId = String(body.offerId ?? "");
  const [offer] = await db
    .select()
    .from(directOffers)
    .where(and(eq(directOffers.id, offerId), eq(directOffers.buyerUserId, user.id)))
    .limit(1);
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.status !== "open")
    return NextResponse.json({ error: `Offer already ${offer.status}` }, { status: 409 });
  if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
    await db.update(directOffers).set({ status: "expired" }).where(eq(directOffers.id, offerId));
    return NextResponse.json({ error: "Offer expired" }, { status: 410 });
  }

  if (body.action === "decline") {
    await db.update(directOffers).set({ status: "declined" }).where(eq(directOffers.id, offerId));
    const sSpace = await spaceFor(offer.sellerUserId);
    await db.insert(alerts).values({
      kind: "offer_declined",
      spaceId: sSpace,
      payload: { title: `Your offer on "${offer.productTitle.slice(0, 60)}" was declined`, priceUsd: offer.priceCents / 100 },
    });
    await audit({
      actor: "user", action: "direct_offer_declined", userId: user.id, input: { offerId },
      rationale: "Buyer declined a targeted offer",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "accept") {
    if (user.role === "demo")
      return NextResponse.json({ error: "Demo accounts cannot spend" }, { status: 403 });
    const [product] = await db
      .select()
      .from(sellerProducts)
      .where(eq(sellerProducts.id, offer.productId))
      .limit(1);
    const [profile] = await db
      .select()
      .from(merchantProfiles)
      .where(eq(merchantProfiles.userId, offer.sellerUserId))
      .limit(1);
    const space = await getActiveSpace(user.id);
    const amountCents = offer.priceCents;
    const decision = await checkPolicy({
      amountCents, vendor: profile?.displayName, spaceId: space.id,
    });
    if (!decision.allow)
      return NextResponse.json({ error: `Policy: ${decision.reason}` }, { status: 403 });

    const order = await createEscrowOrder({
      amountCents,
      description: `${offer.productTitle} x1`,
      vendorName: profile?.displayName,
      invoiceKey: `parley-offer-${offerId}`,
      returnUrl: `${env.appUrl}/api/paypal/return`,
      cancelUrl: `${env.appUrl}/api/paypal/cancel`,
    });
    const approveUrl =
      order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href ??
      approveUrlFor(order.id);
    // Ledger + order + offer transition commit atomically — a crash here must
    // not leave a local order row pointing at an orphan PayPal authorization.
    const saleId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(ordersLocal).values({
        id: crypto.randomUUID(),
        userId: user.id, spaceId: space.id,
        paypalOrderId: order.id,
        status: "created",
        title: offer.productTitle,
        vendor: profile?.displayName ?? null,
        amountCents,
        currency: "USD",
        quantity: 1,
        agreedPriceCents: offer.priceCents,
        negotiated: true,
        productSnapshot: {
          id: offer.productId, title: offer.productTitle,
          merchant: profile?.displayName, image: product?.image,
          offers: [{ domain: profile?.displayName ?? "seller", priceCents: offer.priceCents, currency: "USD" }],
        },
      });
      // Close the loop on the seller ledger — their agent "sold" this at the
      // offered price, linked to the buyer's escrow.
      await tx.insert(merchantSales).values({
        id: saleId,
        sellerUserId: offer.sellerUserId,
        productTitle: offer.productTitle,
        agreedCents: offer.priceCents,
        listCents: offer.listCents,
        buyerLabel: `parley-user-${user.id.slice(0, 8)}`,
        buyerOrderId: order.id,
      });
      await tx.execute(sql`
        update seller_products set stock = greatest(stock - 1, 0)
        where id = ${offer.productId} and user_id = ${offer.sellerUserId}`);
      await tx.update(directOffers).set({ status: "accepted" }).where(eq(directOffers.id, offerId));
    });
    // Open the buyer↔seller channel — same as an A2A close. Best-effort:
    // a messaging failure must not orphan an already-created escrow order.
    try {
      const thread = await ensureThread({
        sellerUserId: offer.sellerUserId,
        buyerUserId: user.id,
        saleId,
        subject: offer.productTitle,
      });
      await postMessage({
        threadId: thread.id,
        senderUserId: offer.sellerUserId,
        senderRole: "seller",
        body: `Offer accepted — "${offer.productTitle}" at $${(offer.priceCents / 100).toFixed(2)}. I'll post tracking here when it ships.`,
      });
    } catch { /* the sale stands */ }
    const sSpace = await spaceFor(offer.sellerUserId);
    await db.insert(alerts).values({
      kind: "offer_accepted",
      spaceId: sSpace,
      payload: {
        title: `Your offer on "${offer.productTitle.slice(0, 60)}" was accepted`,
        priceUsd: offer.priceCents / 100,
        reason: "The buyer is approving the escrow on PayPal now.",
      },
    });
    await audit({
      actor: "user", action: "direct_offer_accepted", userId: user.id, spaceId: space.id,
      input: { offerId, priceCents: offer.priceCents, orderId: order.id },
      rationale: `Accepted seller's targeted offer — ${decision.reason}`,
    });
    return NextResponse.json({ ok: true, orderId: order.id, approveUrl });
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
