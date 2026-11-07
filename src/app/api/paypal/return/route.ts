import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authorizeOrder } from "@/lib/paypal";
import { getDb, ensureDb } from "@/lib/db";
import { ordersLocal } from "@/lib/db/schema";
import { audit } from "@/lib/audit";

/**
 * Buyer returns here from PayPal after approving the payment.
 * We convert the approval into an AUTHORIZATION — funds held, not captured.
 * Escrow: the hold releases only when delivery is confirmed.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  const redirect = (q: string) =>
    NextResponse.redirect(new URL(`/?${q}`, url.origin));

  if (!orderId) return redirect("error=missing_order");

  try {
    const auth = await authorizeOrder(orderId);
    const authId =
      auth.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ?? null;

    await ensureDb();
    await getDb()
      .update(ordersLocal)
      .set({ status: "authorized", authorizationId: authId, updatedAt: new Date() })
      .where(eq(ordersLocal.paypalOrderId, orderId));
    await audit({
      actor: "system",
      action: "escrow_authorized",
      input: { orderId, authId },
      output: { status: auth.status },
      rationale: "Buyer approved — funds held pending delivery confirmation",
    });
    return redirect(`authorized=${orderId}`);
  } catch (e) {
    console.error("[paypal/return]", e);
    return redirect("error=authorize_failed");
  }
}
