import { and, desc, eq } from "drizzle-orm";
import { ensureDb, getDb } from "@/lib/db";
import { ordersLocal } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

export const maxDuration = 30;

/** Expense report — the space's orders as CSV. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  await ensureDb();
  const space = await getActiveSpace(user.id);
  const rows = await getDb()
    .select()
    .from(ordersLocal)
    .where(and(eq(ordersLocal.userId, user.id), eq(ordersLocal.spaceId, space.id)))
    .orderBy(desc(ordersLocal.createdAt))
    .limit(500);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    "order_id,product,vendor,status,amount_usd,captured_usd,created_at",
    ...rows.map((o) =>
      [
        esc(o.paypalOrderId), esc(o.title), esc(o.vendor), esc(o.status),
        (o.amountCents / 100).toFixed(2), ((o.capturedCents ?? 0) / 100).toFixed(2),
        esc(o.createdAt?.toISOString()),
      ].join(","),
    ),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="parley-orders-${space.id.slice(0, 8)}.csv"`,
    },
  });
}
