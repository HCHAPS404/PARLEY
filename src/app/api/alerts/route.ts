import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { alerts, ordersLocal } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";
import { captureAuthorization } from "@/lib/paypal";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

/** Approval inbox — open alerts for the active space. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const space = await getActiveSpace(user.id);
  const rows = await getDb()
    .select()
    .from(alerts)
    .where(and(eq(alerts.spaceId, space.id), eq(alerts.status, "open")))
    .orderBy(desc(alerts.createdAt))
    .limit(50);
  return NextResponse.json({ alerts: rows });
}

/**
 * Act on an alert — the visible human-in-the-loop.
 * release: capture the escrow on a delivered order.
 * approveReorder: mark acted (the human approves on PayPal itself).
 * dismiss: close the alert.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { alertId, action } = (await req.json()) as { alertId?: number; action?: string };
  if (!alertId || !action) return NextResponse.json({ error: "alertId + action required" }, { status: 400 });
  await ensureDb();
  const db = getDb();
  const space = await getActiveSpace(user.id);
  const [alert] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.spaceId, space.id), eq(alerts.status, "open")))
    .limit(1);
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  const payload = (alert.payload ?? {}) as Record<string, unknown>;

  if (action === "release") {
    if (user.role !== "admin")
      return NextResponse.json({ error: "Only admin releases escrow" }, { status: 403 });
    const paypalOrderId = String(payload.paypalOrderId ?? "");
    const [order] = await db
      .select()
      .from(ordersLocal)
      .where(and(eq(ordersLocal.paypalOrderId, paypalOrderId), eq(ordersLocal.userId, user.id)))
      .limit(1);
    if (!order?.authorizationId)
      return NextResponse.json({ error: "No authorization hold on this order" }, { status: 400 });
    const cap = await captureAuthorization(order.authorizationId);
    await db
      .update(ordersLocal)
      .set({ status: "captured", capturedCents: order.amountCents, updatedAt: new Date() })
      .where(eq(ordersLocal.paypalOrderId, paypalOrderId));
    await audit({
      actor: "user", action: "escrow_released_inbox",
      userId: user.id, spaceId: space.id,
      input: { paypalOrderId, alertId },
      output: cap,
      rationale: "Delivery confirmed via approval inbox — hold released to seller",
    });
    await db.update(alerts).set({ status: "acted" }).where(eq(alerts.id, alertId));
    return NextResponse.json({ ok: true, status: "captured", captureId: cap.id });
  }

  if (action === "approveReorder") {
    await db.update(alerts).set({ status: "acted" }).where(eq(alerts.id, alertId));
    await audit({
      actor: "user", action: "reorder_approved_inbox",
      userId: user.id, spaceId: space.id,
      input: { alertId, paypalOrderId: payload.paypalOrderId },
      rationale: "Reorder rule output approved — buyer completes on PayPal",
    });
    return NextResponse.json({ ok: true, approveUrl: payload.approveUrl ?? null });
  }

  if (action === "dismiss") {
    await db.update(alerts).set({ status: "dismissed" }).where(eq(alerts.id, alertId));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
