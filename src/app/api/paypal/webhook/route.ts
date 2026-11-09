import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ensureDb, getDb } from "@/lib/db";
import { audit } from "@/lib/audit";

export const maxDuration = 30;

/**
 * PayPal webhooks — real-time reconciliation instead of waiting for the
 * watchdog's 15-min poll. Register at developer.paypal.com → your app →
 * Webhooks → add `<app>/api/paypal/webhook` and subscribe to:
 *   CHECKOUT.ORDER.APPROVED · PAYMENT.AUTHORIZATION.CREATED ·
 *   PAYMENT.AUTHORIZATION.VOIDED · PAYMENT.CAPTURE.COMPLETED
 * NOTE: production should also verify signatures via
 * /v1/notifications/verify-webhook-signature with the webhook id.
 */
export async function POST(req: Request) {
  const event = (await req.json().catch(() => null)) as {
    event_type?: string;
    resource?: Record<string, unknown>;
  } | null;
  if (!event?.event_type || !event.resource)
    return NextResponse.json({ ok: false }, { status: 400 });

  await ensureDb();
  const db = getDb();
  const r = event.resource;
  const orderId = (r.supplementary_data as { related_ids?: { order_id?: string } })
    ?.related_ids?.order_id ?? (r.id as string | undefined);
  let touched = 0;

  const bump = async (status: string, extra: Record<string, unknown> = {}) => {
    if (!orderId) return;
    const res = await db.execute(sql`
      update orders_local set status = ${status}, updated_at = now()
      ${extra.authorizationId ? sql`, authorization_id = ${String(extra.authorizationId)}` : sql``}
      where paypal_order_id = ${orderId}`);
    touched = (res as { rowCount?: number })?.rowCount ?? 0;
  };

  switch (event.event_type) {
    case "CHECKOUT.ORDER.APPROVED":
      await bump("approved");
      break;
    case "PAYMENT.AUTHORIZATION.CREATED":
      await bump("authorized", { authorizationId: r.id });
      break;
    case "PAYMENT.AUTHORIZATION.VOIDED":
      await bump("voided");
      break;
    case "PAYMENT.CAPTURE.COMPLETED":
      await bump("captured");
      break;
    default:
      break;
  }

  await audit({
    actor: "system",
    action: "paypal_webhook",
    input: { eventType: event.event_type, orderId },
    output: { touched },
    rationale: "Real-time reconciliation pushed by PayPal",
  });
  return NextResponse.json({ ok: true, touched });
}
