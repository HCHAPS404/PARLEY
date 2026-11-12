/**
 * The relationship layer — everything that turns one A2A handshake into an
 * ongoing buyer↔seller channel: thread lookup, buyer-label resolution, and
 * the reputation feedback into vendorScores.
 */
import { and, eq, like, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  dealMessages,
  dealThreads,
  merchantProfiles,
  merchantSales,
  ordersLocal,
  sellerEvents,
  sellerReviews,
  users,
  vendorScores,
} from "./db/schema";

/** The handle a buyer's agent reports to merchant agents — stable per user. */
export const buyerLabelFor = (userId: string) => `parley-user-${userId.slice(0, 8)}`;

/** Resolve a buyerLabel back to a real Parley user, when they're one of ours. */
export async function buyerUserForLabel(
  label: string | null | undefined,
): Promise<{ id: string; username: string; email: string } | null> {
  const m = /^parley-user-([a-f0-9]{8})/.exec(label ?? "");
  if (!m) return null;
  const [u] = await getDb()
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(like(users.id, `${m[1]}%`))
    .limit(1);
  return u ?? null;
}

/** The merchant profile + display name for a seller user, if they have one. */
export async function sellerProfileForUser(sellerUserId: string) {
  const [p] = await getDb()
    .select()
    .from(merchantProfiles)
    .where(eq(merchantProfiles.userId, sellerUserId))
    .limit(1);
  return p ?? null;
}

/** One thread per buyer↔seller pair — the relationship channel. */
export async function ensureThread(input: {
  buyerUserId: string;
  sellerUserId: string;
  buyerLabel?: string | null;
  subject?: string | null;
  saleId?: string | null;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(dealThreads)
    .where(
      and(
        eq(dealThreads.buyerUserId, input.buyerUserId),
        eq(dealThreads.sellerUserId, input.sellerUserId),
      ),
    )
    .limit(1);
  if (existing) {
    // Keep the thread fresh: latest subject/sale win if provided.
    if (input.subject || input.saleId) {
      await db
        .update(dealThreads)
        .set({
          ...(input.subject ? { subject: input.subject } : {}),
          ...(input.saleId ? { saleId: input.saleId } : {}),
        })
        .where(eq(dealThreads.id, existing.id));
    }
    return existing;
  }
  const id = `thr_${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(dealThreads).values({
    id,
    buyerUserId: input.buyerUserId,
    sellerUserId: input.sellerUserId,
    buyerLabel: input.buyerLabel ?? null,
    subject: input.subject ?? null,
    saleId: input.saleId ?? null,
  });
  return {
    id,
    buyerUserId: input.buyerUserId,
    sellerUserId: input.sellerUserId,
    buyerLabel: input.buyerLabel ?? null,
    subject: input.subject ?? null,
    saleId: input.saleId ?? null,
    lastMsgAt: new Date(),
    buyerUnread: 0,
    sellerUnread: 0,
    createdAt: new Date(),
  };
}

/** Post a message and bump the counterpart's unread counter. */
export async function postMessage(input: {
  threadId: string;
  senderUserId: string;
  senderRole: "buyer" | "seller" | "system";
  body: string;
  /** Optional photo attachment — data URL capped server-side. */
  image?: string | null;
  /** Which side's unread counter bumps — person messages bump the counterpart,
   * system events choose explicitly. */
  unreadFor?: "buyer" | "seller" | "none";
}) {
  const db = getDb();
  const id = `msg_${crypto.randomUUID().slice(0, 8)}`;
  // Images must be same-origin data URLs — never remote fetches through us.
  const image =
    input.image && input.image.startsWith("data:image/") && input.image.length <= 400_000
      ? input.image
      : null;
  await db.insert(dealMessages).values({
    id,
    threadId: input.threadId,
    senderUserId: input.senderUserId,
    senderRole: input.senderRole,
    body: input.body.slice(0, 2000),
    image,
  });
  const unreadFor =
    input.unreadFor ??
    (input.senderRole === "buyer" ? "seller" : input.senderRole === "seller" ? "buyer" : "none");
  await db
    .update(dealThreads)
    .set({
      lastMsgAt: new Date(),
      ...(unreadFor === "seller"
        ? { sellerUnread: sql`${dealThreads.sellerUnread} + 1` }
        : unreadFor === "buyer"
          ? { buyerUnread: sql`${dealThreads.buyerUnread} + 1` }
          : {}),
    })
    .where(eq(dealThreads.id, input.threadId));
  return { id };
}

/**
 * Lifecycle event into the buyer↔seller channel — "escrow funded", "shipped",
 * "delivered", "captured", "problem reported". The channel becomes the shared
 * operational timeline for the order, not just a chat.
 */
export async function postSystemMessage(input: {
  sellerUserId: string;
  buyerUserId: string;
  body: string;
  unreadFor?: "buyer" | "seller" | "none";
  subject?: string | null;
  saleId?: string | null;
}) {
  const thread = await ensureThread({
    sellerUserId: input.sellerUserId,
    buyerUserId: input.buyerUserId,
    subject: input.subject,
    saleId: input.saleId,
  });
  return postMessage({
    threadId: thread.id,
    senderUserId: input.sellerUserId,
    senderRole: "system",
    body: input.body,
    unreadFor: input.unreadFor ?? "buyer",
  });
}

/** Resolve the buyer↔seller pair behind a PayPal order — via the seller's
 * ledger entry that links it back to a Parley buyer. */
export async function partiesForOrder(paypalOrderId: string) {
  const db = getDb();
  const [sale] = await db
    .select({
      sellerUserId: merchantSales.sellerUserId,
      saleId: merchantSales.id,
      title: merchantSales.productTitle,
    })
    .from(merchantSales)
    .where(eq(merchantSales.buyerOrderId, paypalOrderId))
    .limit(1);
  if (!sale?.sellerUserId) return null;
  const [order] = await db
    .select({ userId: ordersLocal.userId })
    .from(ordersLocal)
    .where(eq(ordersLocal.paypalOrderId, paypalOrderId))
    .limit(1);
  if (!order?.userId) return null;
  return {
    sellerUserId: sale.sellerUserId,
    buyerUserId: order.userId,
    saleId: sale.saleId,
    title: sale.title,
  };
}

/** How many past deals this buyer closed with this seller — loyalty context
 * the merchant agent can weigh when negotiating. */
export async function repeatDealsFor(sellerUserId: string, buyerLabel: string | null) {
  if (!buyerLabel) return 0;
  const rows = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(merchantSales)
    .where(
      and(
        eq(merchantSales.sellerUserId, sellerUserId),
        eq(merchantSales.buyerLabel, buyerLabel),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

/** Record one seller-side interaction — event feed entry; on accept also the
 * sale ledger row, stock decrement and the buyer↔seller thread opening.
 * Used by the in-process negotiation path (MCP route has its own richer
 * version with alerts + auto-invoicing). */
export async function recordSellerInteraction(input: {
  sellerUserId: string;
  productId?: string;
  productTitle: string;
  buyerLabel?: string | null;
  kind: "offer" | "counter" | "accept" | "walk";
  offerCents?: number | null;
  counterCents?: number | null;
  message?: string | null;
  listCents?: number | null;
}): Promise<string | null> {
  const db = getDb();
  await db.insert(sellerEvents).values({
    id: crypto.randomUUID(),
    sellerUserId: input.sellerUserId,
    productTitle: input.productTitle,
    buyerLabel: input.buyerLabel ?? null,
    kind: input.kind,
    offerCents: input.offerCents ?? null,
    counterCents: input.counterCents ?? null,
    message: input.message ?? null,
  });
  if (input.kind !== "accept" || input.counterCents == null) return null;
  const saleId = crypto.randomUUID();
  await db.insert(merchantSales).values({
    id: saleId,
    sellerUserId: input.sellerUserId,
    productTitle: input.productTitle,
    agreedCents: input.counterCents,
    listCents: input.listCents ?? null,
    buyerLabel: input.buyerLabel ?? null,
  });
  if (input.productId) {
    await db.execute(sql`
      update seller_products set stock = greatest(stock - 1, 0)
      where id = ${input.productId} and user_id = ${input.sellerUserId}`);
  }
  const buyerUser = await buyerUserForLabel(input.buyerLabel);
  if (buyerUser) {
    const thread = await ensureThread({
      buyerUserId: buyerUser.id,
      sellerUserId: input.sellerUserId,
      buyerLabel: input.buyerLabel,
      subject: input.productTitle,
      saleId,
    });
    await postMessage({
      threadId: thread.id,
      senderUserId: input.sellerUserId,
      senderRole: "seller",
      body: `Deal closed at $${(input.counterCents / 100).toFixed(2)} — your order is on the books. I'll post tracking here when it ships.`,
    });
  }
  return saleId;
}

/** Aggregate a seller's review history → their public score, fed into
 * vendorScores so the buyer agent also weighs it in search ranking. */
export async function syncSellerScore(sellerUserId: string, displayName: string) {
  const db = getDb();
  const rows = await db
    .select({ n: sql<number>`count(*)`, avg: sql<number>`avg(rating)` })
    .from(sellerReviews)
    .where(eq(sellerReviews.sellerUserId, sellerUserId));
  const n = Number(rows[0]?.n ?? 0);
  if (!n) return;
  const avg = Number(rows[0]?.avg ?? 0);
  const score = Math.round((avg / 5) * 100);
  await db
    .insert(vendorScores)
    .values({
      domain: displayName,
      score,
      ordersCount: n,
      updatedAt: new Date(),
      notes: `Community rating — ${avg.toFixed(1)}/5 across ${n} review${n === 1 ? "" : "s"}`,
    })
    .onConflictDoUpdate({
      target: vendorScores.domain,
      set: { score, ordersCount: n, updatedAt: new Date() },
    });
  return { score, count: n, avg };
}
