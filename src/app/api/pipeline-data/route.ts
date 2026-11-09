import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { ordersLocal } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

/**
 * Escrow orders as Gantt tasks: each order is a parent task whose phases map
 * to the escrow lifecycle (created → approved → authorized → shipped → delivered → captured).
 * Undelivered orders project an expected delivery date; late ones surface as overdue.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const db = getDb();
  const space = await getActiveSpace(user.id);
  const orders = await db
    .select()
    .from(ordersLocal)
    .where(and(eq(ordersLocal.userId, user.id), eq(ordersLocal.spaceId, space.id)))
    .orderBy(desc(ordersLocal.createdAt))
    .limit(100);

  const now = Date.now();
  const DAY = 86_400_000;

  const tasks = orders.flatMap((o, i) => {
    const created = o.createdAt?.getTime() ?? now;
    const delivered = o.deliveredAt?.getTime();
    // Expected delivery: created + 7 days unless already delivered.
    const expectedEnd = delivered ?? created + 7 * DAY;
    const overdue =
      !delivered && !["captured", "voided", "cancelled"].includes(o.status) && expectedEnd < now;
    const done =
      o.status === "captured"
        ? 100
        : o.status === "voided" || o.status === "cancelled"
          ? 100
          : o.status === "authorized"
            ? 55
            : o.status === "approved"
              ? 35
              : 15;
    const cls = overdue
      ? "b-overdue"
      : o.status === "captured"
        ? "b-done"
        : o.status === "voided" || o.status === "cancelled"
          ? "b-voided"
          : "";

    return [
      {
        id: i + 1,
        name: `${o.title} — ${o.vendor ?? "vendor"} ($${((o.amountCents ?? 0) / 100).toFixed(2)})`,
        startDate: new Date(created).toISOString(),
        endDate: new Date(Math.max(expectedEnd, now)).toISOString(),
        percentDone: done,
        status: o.status,
        cls,
      },
    ];
  });

  return Response.json({ tasks });
}
