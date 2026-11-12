import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { merchantProfiles, merchantSales, ordersLocal, sellerReviews, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { canReviewOrder } from "@/lib/claims";
import { syncSellerScore } from "@/lib/relationships";
import { audit } from "@/lib/audit";

export const maxDuration = 30;

/**
 * Reviews — the buyer's voice after delivery.
 * GET: seller sees their rating summary + comments; buyer sees what they wrote.
 * POST {sellerUserId?, orderId, rating 1-5, comment} — buyer rates a completed order.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const db = getDb();
  const asSeller = user.persona === "seller";
  const rows = await db
    .select()
    .from(sellerReviews)
    .where(
      asSeller
        ? eq(sellerReviews.sellerUserId, user.id)
        : eq(sellerReviews.buyerUserId, user.id),
    )
    .orderBy(desc(sellerReviews.createdAt))
    .limit(50);
  const reviews = await Promise.all(
    rows.map(async (r) => {
      if (asSeller) {
        const [b] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, r.buyerUserId))
          .limit(1);
        return { ...r, counterpart: b?.username ?? "buyer" };
      }
      const [mp] = await db
        .select({ displayName: merchantProfiles.displayName })
        .from(merchantProfiles)
        .where(eq(merchantProfiles.userId, r.sellerUserId))
        .limit(1);
      return { ...r, counterpart: mp?.displayName ?? "seller" };
    }),
  );
  const summary = asSeller
    ? await db
        .select({ n: sql<number>`count(*)`, avg: sql<number>`avg(rating)` })
        .from(sellerReviews)
        .where(eq(sellerReviews.sellerUserId, user.id))
    : null;
  return NextResponse.json({
    reviews,
    summary: summary
      ? { count: Number(summary[0]?.n ?? 0), avg: Number(summary[0]?.avg ?? 0) }
      : null,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.persona === "seller")
    return NextResponse.json({ error: "Buyers review sellers" }, { status: 403 });
  const body = (await req.json()) as {
    orderId?: string;
    sellerUserId?: string;
    rating?: number;
    comment?: string;
  };
  const rating = Math.round(Number(body.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return NextResponse.json({ error: "rating 1–5 required" }, { status: 400 });
  await ensureDb();
  const db = getDb();

  // The order must be the caller's, captured/delivered, and not yet reviewed.
  const orderId = String(body.orderId ?? "");
  const [order] = await db
    .select()
    .from(ordersLocal)
    .where(and(eq(ordersLocal.paypalOrderId, orderId), eq(ordersLocal.userId, user.id)))
    .limit(1);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canReviewOrder(order.status))
    return NextResponse.json({ error: "Rate after delivery completes" }, { status: 400 });
  // The seller is derived server-side — the client cannot attach a review to
  // an arbitrary merchant. Parley sale first, vendor-name match as fallback.
  const [sale] = await db
    .select({ sellerUserId: merchantSales.sellerUserId })
    .from(merchantSales)
    .where(eq(merchantSales.buyerOrderId, orderId))
    .limit(1);
  let sellerUserId = sale?.sellerUserId ?? "";
  if (!sellerUserId && order.vendor) {
    const [mp] = await db
      .select({ userId: merchantProfiles.userId })
      .from(merchantProfiles)
      .where(eq(merchantProfiles.displayName, order.vendor))
      .limit(1);
    sellerUserId = mp?.userId ?? "";
  }
  if (!sellerUserId)
    return NextResponse.json({ error: "No Parley seller behind this order" }, { status: 400 });
  if (body.sellerUserId && body.sellerUserId !== sellerUserId)
    return NextResponse.json({ error: "Seller mismatch for this order" }, { status: 400 });
  const [dupe] = await db
    .select({ id: sellerReviews.id })
    .from(sellerReviews)
    .where(and(eq(sellerReviews.orderId, orderId), eq(sellerReviews.buyerUserId, user.id)))
    .limit(1);
  if (dupe) return NextResponse.json({ error: "Already reviewed this order" }, { status: 409 });

  const id = `rev_${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(sellerReviews).values({
    id,
    sellerUserId,
    buyerUserId: user.id,
    orderId,
    rating,
    comment: String(body.comment ?? "").slice(0, 500) || null,
  });
  const [mp] = await db
    .select({ displayName: merchantProfiles.displayName })
    .from(merchantProfiles)
    .where(eq(merchantProfiles.userId, sellerUserId))
    .limit(1);
  const score = mp ? await syncSellerScore(sellerUserId, mp.displayName) : null;
  await audit({
    actor: "user", action: "seller_reviewed", userId: user.id,
    input: { orderId, sellerUserId, rating },
    output: score ?? null,
    rationale: "Buyer rated the seller after delivery — feeds vendor reputation",
  });
  return NextResponse.json({ ok: true, id, vendorScore: score ?? null });
}
