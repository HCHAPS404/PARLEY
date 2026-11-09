import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { alerts, auditLog, ordersLocal, vendorScores } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

const money = (cents: number | null) =>
  cents == null ? null : Math.round(cents) / 100;

export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const db = getDb();
  const space = await getActiveSpace(user.id);

  const [orders, audit, vendors, alertRows] = await Promise.all([
    db
      .select()
      .from(ordersLocal)
      .where(and(eq(ordersLocal.userId, user.id), eq(ordersLocal.spaceId, space.id)))
      .orderBy(desc(ordersLocal.createdAt))
      .limit(500),
    db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, user.id), eq(auditLog.spaceId, space.id)))
      .orderBy(desc(auditLog.ts))
      .limit(500),
    db.select().from(vendorScores).limit(200), // vendor reputation is shared truth
    db
      .select()
      .from(alerts)
      .where(eq(alerts.spaceId, space.id))
      .orderBy(desc(alerts.createdAt))
      .limit(200),
  ]);

  return Response.json({
    sources: [
      {
        id: "orders",
        data: orders.map((o) => ({
          paypal_order_id: o.paypalOrderId,
          status: o.status,
          title: o.title,
          vendor: o.vendor,
          amount_usd: money(o.amountCents),
          agreed_usd: money(o.agreedPriceCents),
          quantity: o.quantity,
          negotiated: o.negotiated,
          created_at: o.createdAt?.toISOString(),
          delivered_at: o.deliveredAt?.toISOString(),
        })),
      },
      {
        id: "agent_activity",
        data: audit.map((a) => ({
          ts: a.ts.toISOString(),
          actor: a.actor,
          action: a.action,
          rationale: a.rationale,
          tokens_in: a.tokensIn,
          tokens_out: a.tokensOut,
          cost_usd: a.costUsd == null ? null : Number(a.costUsd),
        })),
      },
      {
        id: "vendor_scores",
        data: vendors.map((v) => ({
          domain: v.domain,
          score: v.score,
          orders_count: v.ordersCount,
          on_time_count: v.onTimeCount,
          disputes_count: v.disputesCount,
          updated_at: v.updatedAt?.toISOString(),
        })),
      },
      {
        id: "alerts",
        data: alertRows.map((a) => ({
          created_at: a.createdAt.toISOString(),
          kind: a.kind,
          status: a.status,
        })),
      },
    ],
  });
}
