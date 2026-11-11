import { and, desc, eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { alerts, merchantSales, ordersLocal, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";
import { captureAuthorization } from "@/lib/paypal";
import { paypalTools } from "@/lib/paypal-toolkit";
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
    if (user.role === "demo")
      return NextResponse.json({ error: "Demo accounts cannot release escrow" }, { status: 403 });
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

  if (action === "issueInvoice") {
    if (user.role === "demo")
      return NextResponse.json({ error: "Demo accounts cannot issue invoices" }, { status: 403 });
    const [sale] = await db
      .select()
      .from(merchantSales)
      .where(eq(merchantSales.id, String(payload.saleId ?? "")))
      .limit(1);
    if (!sale || sale.sellerUserId !== user.id)
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    if (sale.status === "invoiced")
      return NextResponse.json({ error: "Already invoiced" }, { status: 409 });
    // buyer label "parley-user-<8>" → resolve the buyer's billing email
    const m = /^parley-user-([a-f0-9]{8})/.exec(sale.buyerLabel ?? "");
    const [buyer] = m
      ? await db.select({ email: users.email }).from(users).where(like(users.id, `${m[1]}%`)).limit(1)
      : [null];
    if (!buyer?.email)
      return NextResponse.json({ error: "Buyer billing email not on record" }, { status: 400 });
    const tools = paypalTools() as Record<string, { execute?: (a: unknown) => Promise<unknown> }>;
    const value = (sale.agreedCents / 100).toFixed(2);
    const created = (await tools["create_invoice"]?.execute?.({
      detail: { currency_code: "USD", note: "Parley A2A sale", payment_term: { term_type: "DUE_ON_RECEIPT" } },
      primary_recipients: [{ billing_info: { email_address: buyer.email } }],
      items: [{ name: sale.productTitle.slice(0, 127), quantity: "1", unit_amount: { currency_code: "USD", value } }],
      amount: { breakdown: { item_total: { currency_code: "USD", value } } },
    })) as { id?: string } | undefined;
    if (!created?.id)
      return NextResponse.json({ error: "Invoice creation failed" }, { status: 502 });
    await tools["send_invoice"]?.execute?.({ invoice_id: created.id });
    await db.update(merchantSales).set({ status: "invoiced" }).where(eq(merchantSales.id, sale.id));
    await db.update(alerts).set({ status: "acted" }).where(eq(alerts.id, alertId));
    await audit({
      actor: "user", action: "sale_invoiced_inbox",
      userId: user.id, spaceId: space.id,
      input: { alertId, saleId: sale.id },
      output: { invoiceId: created.id },
      rationale: "Seller issued the invoice from the approval inbox",
    });
    return NextResponse.json({ ok: true, invoiceId: created.id });
  }

  if (action === "dismiss") {
    await db.update(alerts).set({ status: "dismissed" }).where(eq(alerts.id, alertId));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
