import { desc } from "drizzle-orm";
import { ensureDb, getDb } from "@/lib/db";
import { ordersLocal } from "@/lib/db/schema";

/**
 * Escrow orders as Gantt tasks: each order is a parent task whose phases map
 * to the escrow lifecycle (created → approved → authorized → shipped → delivered → captured).
 * Undelivered orders project an expected delivery date; late ones surface as overdue.
 */
export async function GET() {
  await ensureDb();
  const db = getDb();
  const orders = await db
    .select()
    .from(ordersLocal)
    .orderBy(desc(ordersLocal.createdAt))
    .limit(100);

  const now = Date.now();
  const DAY = 86_400_000;

  const tasks = orders.flatMap((o, i) => {
    const created = o.createdAt?.getTime() ?? now;
    const delivered = o.deliveredAt?.getTime();
    // Expected delivery: created + 7 days unless already delivered.
    const expectedEnd = delivered ?? created + 7 * DAY;
    const overdue = !delivered && expectedEnd < now;
    const done =
      o.status === "captured" ? 100 : o.status === "authorized" ? 55 : o.status === "approved" ? 35 : 15;

    return [
      {
        id: i + 1,
        name: `${o.title} — ${o.vendor ?? "vendor"} ($${((o.amountCents ?? 0) / 100).toFixed(2)})`,
        startDate: new Date(created).toISOString(),
        endDate: new Date(Math.max(expectedEnd, now)).toISOString(),
        percentDone: done,
        status: o.status,
        cls: overdue ? "b-overdue" : o.status === "captured" ? "b-done" : "",
      },
    ];
  });

  return Response.json({ tasks });
}
