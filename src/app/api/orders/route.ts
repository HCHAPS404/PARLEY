import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { alerts, merchantSales, ordersLocal, spaces } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { partiesForOrder, postSystemMessage } from "@/lib/relationships";
import { canConfirmReceipt, canReportOrder } from "@/lib/claims";
import { audit } from "@/lib/audit";

export const maxDuration = 30;

async function spaceFor(userId: string) {
  const [s] = await getDb()
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.userId, userId))
    .limit(1);
  return s?.id ?? null;
}

/**
 * Order claims — the escrow's unhappy path, which is what makes the happy
 * path trustworthy.
 *
 * POST {action:"report", orderId, note}   — buyer flags a problem while the
 *   money is still held: seller gets an alert + the thread gets the claim.
 * POST {action:"resolve", orderId}        — seller marks it handled; the flag
 *   clears and the buyer is told in the channel.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    action?: string;
    orderId?: string;
    note?: string;
  };
  const orderId = String(body.orderId ?? "");
  await ensureDb();
  const db = getDb();

  // ── Buyer reports a problem ──────────────────────────────────────────
  if (body.action === "report") {
    const [order] = await db
      .select()
      .from(ordersLocal)
      .where(and(eq(ordersLocal.paypalOrderId, orderId), eq(ordersLocal.userId, user.id)))
      .limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!canReportOrder(order.status, order.disputedAt))
      return NextResponse.json(
        { error: order.disputedAt ? "A claim is already open on this order" : `Order is ${order.status} — claims only while escrow is open` },
        { status: order.disputedAt ? 409 : 400 },
      );
    const note = String(body.note ?? "").slice(0, 300);
    if (!note) return NextResponse.json({ error: "Describe the problem" }, { status: 400 });

    await db
      .update(ordersLocal)
      .set({ disputedAt: new Date(), disputeNote: note, updatedAt: new Date() })
      .where(eq(ordersLocal.paypalOrderId, orderId));

    const parties = await partiesForOrder(orderId);
    if (parties) {
      const sSpace = await spaceFor(parties.sellerUserId);
      await db.insert(alerts).values({
        kind: "order_disputed",
        spaceId: sSpace,
        payload: {
          title: `Problem reported on "${order.title.slice(0, 60)}"`,
          reason: note,
          paypalOrderId: orderId,
          priceUsd: order.amountCents / 100,
        },
      });
      try {
        await postSystemMessage({
          ...parties,
          unreadFor: "seller",
          body: `Problem reported by the buyer — "${note}". The escrow stays held while you sort it out here.`,
        });
      } catch { /* the claim stands */ }
    }
    await audit({
      actor: "user", action: "order_disputed", userId: user.id, spaceId: order.spaceId ?? undefined,
      input: { orderId, note },
      rationale: "Buyer flagged a problem — escrow stays held pending resolution",
    });
    return NextResponse.json({ ok: true });
  }

  // ── Buyer confirms receipt — the escrow's payoff path. Real escrow (like
  // AliExpress) releases on carrier DELIVERED *or* buyer confirmation,
  // whichever comes first. In sandbox demos carriers never report, so this
  // is the honest way to complete the arc.
  if (body.action === "confirm_received") {
    const [order] = await db
      .select()
      .from(ordersLocal)
      .where(and(eq(ordersLocal.paypalOrderId, orderId), eq(ordersLocal.userId, user.id)))
      .limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!canConfirmReceipt(order.status, order.deliveredAt, order.disputedAt))
      return NextResponse.json(
        { error: order.disputedAt ? "Resolve the open claim first" : `Cannot confirm — order is ${order.status}` },
        { status: 400 },
      );

    await db
      .update(ordersLocal)
      .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(ordersLocal.paypalOrderId, orderId));
    // Same prompt the watchdog fires on carrier DELIVERED — release is a
    // deliberate second step, the buyer still decides.
    await db.insert(alerts).values({
      kind: "delivered",
      spaceId: order.spaceId,
      payload: {
        paypalOrderId: orderId,
        title: order.title,
        reason: "You confirmed receipt — release the escrow to pay the seller",
      },
    });
    try {
      const parties = await partiesForOrder(orderId);
      if (parties) {
        await postSystemMessage({
          ...parties,
          unreadFor: "seller",
          body: `Buyer confirmed receipt of "${order.title}". Releasing the escrow pays the seller.`,
        });
      }
    } catch { /* the confirmation stands */ }
    await audit({
      actor: "user", action: "receipt_confirmed", userId: user.id, spaceId: order.spaceId ?? undefined,
      input: { orderId },
      rationale: "Buyer confirmed the goods arrived — escrow ready to release",
    });
    return NextResponse.json({ ok: true, status: "delivered" });
  }

  // ── Seller marks the claim resolved ─────────────────────────────────
  if (body.action === "resolve") {
    // The seller's ledger row is the authority that links them to the order.
    const [sale] = await db
      .select()
      .from(merchantSales)
      .where(and(eq(merchantSales.buyerOrderId, orderId), eq(merchantSales.sellerUserId, user.id)))
      .limit(1);
    if (!sale) return NextResponse.json({ error: "Order not found among your sales" }, { status: 404 });
    const [order] = await db
      .select()
      .from(ordersLocal)
      .where(eq(ordersLocal.paypalOrderId, orderId))
      .limit(1);
    if (!order?.disputedAt)
      return NextResponse.json({ error: "No open claim on this order" }, { status: 409 });

    await db
      .update(ordersLocal)
      .set({ disputedAt: null, disputeNote: null, updatedAt: new Date() })
      .where(eq(ordersLocal.paypalOrderId, orderId));

    const bSpace = await spaceFor(order.userId!);
    await db.insert(alerts).values({
      kind: "dispute_resolved",
      spaceId: bSpace,
      payload: {
        title: `Seller resolved your claim on "${order.title.slice(0, 60)}"`,
        reason: "Check the thread — if it looks good, release the escrow.",
        paypalOrderId: orderId,
      },
    });
    try {
      const parties = await partiesForOrder(orderId);
      if (parties) {
        await postSystemMessage({
          ...parties,
          unreadFor: "buyer",
          body: `Seller marked the claim as resolved. If it looks good on your end, release the escrow — otherwise say so here.`,
        });
      }
    } catch { /* the resolution stands */ }
    await audit({
      actor: "user", action: "dispute_resolved", userId: user.id,
      input: { orderId },
      rationale: "Seller marked the claim handled — buyer decides the escrow",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
