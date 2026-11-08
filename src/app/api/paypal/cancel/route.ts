import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, ensureDb } from "@/lib/db";
import { ordersLocal } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";

/** Buyer cancelled the PayPal approval — mark the local order, nothing was held. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  if (orderId) {
    await ensureDb();
    await getDb()
      .update(ordersLocal)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(ordersLocal.paypalOrderId, orderId));
    await audit({
      actor: "user",
      action: "escrow_cancelled",
      userId: user.id,
      input: { orderId },
      rationale: "Buyer cancelled at PayPal — no funds held",
    });
  }
  return NextResponse.redirect(new URL("/?cancelled=1", url.origin));
}
