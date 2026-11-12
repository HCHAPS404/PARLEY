import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { merchantProfiles, ordersLocal, sellerReviews } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

export const maxDuration = 30;

/**
 * The buyer's side of the relationship ledger — the Parley sellers they've
 * dealt with, order history per seller, and which completed orders still
 * await a review.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const db = getDb();
  const orders = await db
    .select()
    .from(ordersLocal)
    .where(eq(ordersLocal.userId, user.id))
    .orderBy(desc(ordersLocal.createdAt))
    .limit(200);

  // Match order vendors to real merchant profiles (Parley sellers only).
  const vendorNames = [...new Set(orders.map((o) => o.vendor).filter(Boolean))] as string[];
  const profiles = vendorNames.length
    ? await db
        .select()
        .from(merchantProfiles)
        .where(inArray(merchantProfiles.displayName, vendorNames))
    : [];
  const myReviews = await db
    .select({ orderId: sellerReviews.orderId, rating: sellerReviews.rating })
    .from(sellerReviews)
    .where(eq(sellerReviews.buyerUserId, user.id));
  const reviewed = new Map(myReviews.map((r) => [r.orderId, r.rating]));

  const sellers = profiles.map((p) => {
    const theirs = orders.filter((o) => o.vendor === p.displayName);
    const completed = theirs.filter((o) => o.status === "captured" || o.status === "delivered");
    return {
      sellerUserId: p.userId,
      displayName: p.displayName,
      orders: theirs.length,
      spentCents: theirs.reduce((s, o) => s + o.amountCents, 0),
      lastAt: theirs[0]?.createdAt ?? null,
      // Orders the buyer can still review — captured/delivered, not yet rated.
      pendingReview: completed
        .filter((o) => !reviewed.has(o.paypalOrderId))
        .map((o) => ({ orderId: o.paypalOrderId, title: o.title, amountCents: o.amountCents })),
      myRatings: completed
        .filter((o) => reviewed.has(o.paypalOrderId))
        .map((o) => ({ orderId: o.paypalOrderId, rating: reviewed.get(o.paypalOrderId) })),
    };
  });
  sellers.sort((a, b) => b.spentCents - a.spentCents);
  return NextResponse.json({ sellers });
}
