import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { ordersLocal } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

/** Escrow orders for the pipeline board — lifecycle stage + overdue flag. */
export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const space = await getActiveSpace(user.id);
  const orders = await getDb()
    .select()
    .from(ordersLocal)
    .where(and(eq(ordersLocal.userId, user.id), eq(ordersLocal.spaceId, space.id)))
    .orderBy(desc(ordersLocal.createdAt))
    .limit(100);

  const now = Date.now();
  const DAY = 86_400_000;
  // created(0) → approved(1) → authorized(2) → delivered(3) → captured(4); voided/cancelled = -1
  const stage = (s: string) =>
    s === "captured" ? 4
    : s === "delivered" ? 3
    : s === "authorized" ? 2
    : s === "approved" ? 1
    : s === "voided" || s === "cancelled" || s === "failed" ? -1
    : 0;

  return Response.json({
    orders: orders.map((o) => {
      const created = o.createdAt?.getTime() ?? now;
      const st = stage(o.status);
      const expected = created + 7 * DAY;
      return {
        id: o.paypalOrderId,
        title: o.title,
        vendor: o.vendor,
        amountCents: o.amountCents,
        capturedCents: o.capturedCents,
        status: o.status,
        stage: st,
        overdue: st >= 0 && st < 4 && !o.deliveredAt && expected < now,
        expectedDelivery: new Date(expected).toISOString(),
        createdAt: o.createdAt?.toISOString() ?? null,
        deliveredAt: o.deliveredAt?.toISOString() ?? null,
        trackingNumber: o.trackingNumber,
        carrier: o.carrier,
      };
    }),
  });
}
