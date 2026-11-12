/**
 * One-off repair: void orphan escrow orders created when an offer-accept
 * crashed after the PayPal call but before the local writes finished.
 * Also removes their duplicate merchant_sales rows and restores the stock
 * they decremented.
 *
 *   npx tsx scripts/cleanup-orphan-orders.ts <paypalOrderId> [<paypalOrderId>...]
 */
import { eq, inArray, sql } from "drizzle-orm";
import { ensureDb, getDb } from "../src/lib/db";
import { merchantSales, ordersLocal, sellerProducts } from "../src/lib/db/schema";

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error("usage: npx tsx scripts/cleanup-orphan-orders.ts <orderId>...");
  process.exit(1);
}

async function main() {
  await ensureDb();
  const db = getDb();

  const sales = await db
    .select()
    .from(merchantSales)
    .where(inArray(merchantSales.buyerOrderId, ids));

  const orders = await db
    .update(ordersLocal)
    .set({ status: "voided" })
    .where(inArray(ordersLocal.paypalOrderId, ids))
    .returning({ id: ordersLocal.paypalOrderId });
  console.log(`voided ${orders.length} order(s)`);

  if (sales.length) {
    await db.delete(merchantSales).where(inArray(merchantSales.id, sales.map((s) => s.id)));
    console.log(`removed ${sales.length} duplicate sale(s)`);
    // Each phantom sale decremented stock once — put the units back.
    for (const s of sales) {
      const match = await db
        .select()
        .from(sellerProducts)
        .where(eq(sellerProducts.title, s.productTitle))
        .limit(1);
      if (match[0]) {
        await db.execute(sql`
          update seller_products set stock = stock + 1 where id = ${match[0].id}`);
        console.log(`restored 1 unit to "${match[0].title}"`);
      }
    }
  }
  console.log("done");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
