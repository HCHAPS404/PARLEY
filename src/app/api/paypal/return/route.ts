import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { authorizeOrder } from "@/lib/paypal";
import { getDb, ensureDb } from "@/lib/db";
import { ordersLocal } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";

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

  const user = await getSessionUser();
  if (!user)
    return NextResponse.redirect(new URL("/login", url.origin));
  if (!orderId) return redirect("error=missing_order");

  // Only the order's owner may convert an approval into an authorization.
  await ensureDb();
  const [owner] = await getDb()
    .select({ userId: ordersLocal.userId })
    .from(ordersLocal)
    .where(eq(ordersLocal.paypalOrderId, orderId))
    .limit(1);
  if (owner && owner.userId && owner.userId !== user.id)
    return redirect("error=not_your_order");

  try {
    const auth = await authorizeOrder(orderId);
    const authz = auth.purchase_units?.[0]?.payments?.authorizations?.[0];
    const authId = authz?.id ?? null;
    const authExpires = authz?.expiration_time
      ? new Date(authz.expiration_time)
      : null;

    await getDb()
      .update(ordersLocal)
      .set({
        status: "authorized",
        authorizationId: authId,
        authorizationExpiresAt: authExpires,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ordersLocal.paypalOrderId, orderId),
          eq(ordersLocal.userId, user.id),
        ),
      );
    await audit({
      actor: "system",
      action: "escrow_authorized",
      userId: user.id,
      input: { orderId, authId, authExpires },
      output: { status: auth.status },
      rationale: "Buyer approved — funds held pending delivery confirmation",
    });
    return redirect(`authorized=${orderId}`);
  } catch (e) {
    console.error("[paypal/return]", e);
    return redirect("error=authorize_failed");
  }
}
