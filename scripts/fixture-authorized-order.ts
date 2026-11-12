/**
 * Test fixture: an `authorized` escrow order for a fresh buyer + the matching
 * merchant_sales row so the relationship thread can form.
 *
 *   npx tsx scripts/_fixture-authorized-order.ts <buyerUserId> <sellerUserId> <paypalOrderId>
 */
import { eq } from "drizzle-orm";
import { ensureDb, getDb } from "../src/lib/db";
import { merchantSales, ordersLocal, spaces } from "../src/lib/db/schema";
import { randomUUID } from "crypto";

const [buyerUserId, sellerUserId, paypalOrderId] = process.argv.slice(2);
if (!buyerUserId || !sellerUserId || !paypalOrderId) {
  console.error("usage: npx tsx scripts/_fixture-authorized-order.ts <buyerUserId> <sellerUserId> <paypalOrderId>");
  process.exit(1);
}

async function main() {
  await ensureDb();
  const db = getDb();
  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.userId, buyerUserId))
    .limit(1);

  await db.insert(ordersLocal).values({
    id: randomUUID(),
    userId: buyerUserId,
    spaceId: space?.id ?? null,
    paypalOrderId,
    authorizationId: `AUTH-${paypalOrderId}`,
    status: "authorized",
    title: "Fixture — kraft mailer boxes (50-pack)",
    vendor: "seller2's store",
    amountCents: 3800,
    agreedPriceCents: 3800,
    negotiated: true,
  });

  await db.insert(merchantSales).values({
    id: `sale_${randomUUID().slice(0, 8)}`,
    sellerUserId,
    productTitle: "Fixture — kraft mailer boxes (50-pack)",
    agreedCents: 3800,
    listCents: 4200,
    buyerLabel: "buyer2",
    buyerOrderId: paypalOrderId,
    status: "agreed",
  });

  console.log(`fixture ready: order ${paypalOrderId} authorized, sale linked`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
