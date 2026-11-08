/**
 * Seed a believable order history for the admin user so the analytics and
 * pipeline dashboards have something real to render. Idempotent — rows are
 * keyed by deterministic paypal_order_id values (SEED-*), safe to re-run.
 *
 *   npx tsx scripts/seed-demo.ts            (local PGlite)
 *   DATABASE_URL=... npx tsx scripts/seed-demo.ts   (Neon/prod)
 */
import { ensureDb, getDb } from "../src/lib/db";
import {
  ordersLocal,
  vendorScores,
  alerts,
  users,
  auditLog,
} from "../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const DAY = 86_400_000;
const now = Date.now();

type SeedOrder = {
  key: string;
  daysAgo: number;
  status: string;
  title: string;
  vendor: string;
  cents: number;
  qty?: number;
  negotiated?: boolean;
  agreedCents?: number;
  delivered?: boolean;
};

const ORDERS: SeedOrder[] = [
  { key: "01", daysAgo: 13, status: "captured", title: "Logitech Brio 500 Webcam", vendor: "newegg.com", cents: 9499, negotiated: true, agreedCents: 8999, delivered: true },
  { key: "02", daysAgo: 12, status: "captured", title: "Anker 737 Power Bank 24K", vendor: "walmart.com", cents: 7999, delivered: true },
  { key: "03", daysAgo: 11, status: "voided", title: "USB-C Docking Station 11-in-1", vendor: "monoprice.com", cents: 12900, negotiated: true, agreedCents: 11900 },
  { key: "04", daysAgo: 10, status: "captured", title: "Elgato Stream Deck Mini", vendor: "bhphotovideo.com", cents: 5999, delivered: true },
  { key: "05", daysAgo: 9, status: "captured", title: "Logitech MX Master 3S", vendor: "bestbuy.com", cents: 9999, negotiated: true, agreedCents: 9299, delivered: true },
  { key: "06", daysAgo: 8, status: "cancelled", title: "Rode VideoMicro II", vendor: "bhphotovideo.com", cents: 5900 },
  { key: "07", daysAgo: 6, status: "captured", title: "Keychron K3 Pro Keyboard", vendor: "newegg.com", cents: 8499, delivered: true },
  { key: "08", daysAgo: 5, status: "authorized", title: "Poly Voyager 5200 Headset", vendor: "walmart.com", cents: 9999, negotiated: true, agreedCents: 9449 },
  { key: "09", daysAgo: 4, status: "authorized", title: "CalDigit TS4 Thunderbolt Dock", vendor: "bhphotovideo.com", cents: 37995, negotiated: true, agreedCents: 34995 },
  { key: "10", daysAgo: 2, status: "created", title: "Logitech Litra Glow Light", vendor: "bestbuy.com", cents: 5999 },
  { key: "11", daysAgo: 1, status: "approved", title: "Blue Yeti Nano Microphone", vendor: "newegg.com", cents: 7999, negotiated: true, agreedCents: 7499 },
  { key: "12", daysAgo: 0, status: "created", title: "Anker USB-C Hub 7-in-1", vendor: "walmart.com", cents: 3499 },
];

const VENDORS: Record<string, { score: number; orders: number; onTime: number; disputes: number }> = {
  "newegg.com": { score: 82, orders: 4, onTime: 4, disputes: 0 },
  "walmart.com": { score: 74, orders: 3, onTime: 2, disputes: 0 },
  "bhphotovideo.com": { score: 88, orders: 3, onTime: 3, disputes: 0 },
  "bestbuy.com": { score: 70, orders: 2, onTime: 1, disputes: 0 },
  "monoprice.com": { score: 34, orders: 1, onTime: 0, disputes: 1 },
};

async function main() {
  await ensureDb();
  const db = getDb();

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (!admin) throw new Error("No admin user found — run the app once so the seed creates it.");

  for (const o of ORDERS) {
    const created = new Date(now - o.daysAgo * DAY - 3_600_000);
    const updated = new Date(created.getTime() + 1_800_000);
    await db
      .insert(ordersLocal)
      .values({
        id: `seed-${o.key}`,
        userId: admin.id,
        paypalOrderId: `SEED-${o.key}A9${o.key}X`,
        authorizationId: ["authorized", "captured", "voided"].includes(o.status)
          ? `SEEDAUTH-${o.key}`
          : null,
        authorizationExpiresAt: ["authorized"].includes(o.status)
          ? new Date(now + 3 * DAY)
          : null,
        status: o.status,
        title: o.title,
        vendor: o.vendor,
        amountCents: o.cents,
        currency: "USD",
        quantity: o.qty ?? 1,
        agreedPriceCents: o.agreedCents ?? null,
        negotiated: o.negotiated ?? false,
        productSnapshot: { id: `seed-product-${o.key}`, title: o.title },
        createdAt: created,
        updatedAt: updated,
        deliveredAt: o.delivered ? new Date(created.getTime() + 4 * DAY) : null,
      })
      .onConflictDoNothing();
  }

  for (const [domain, v] of Object.entries(VENDORS)) {
    await db
      .insert(vendorScores)
      .values({
        domain,
        score: v.score,
        ordersCount: v.orders,
        onTimeCount: v.onTime,
        disputesCount: v.disputes,
        notes: "seeded demo history",
      })
      .onConflictDoUpdate({
        target: vendorScores.domain,
        set: {
          score: v.score,
          ordersCount: v.orders,
          onTimeCount: v.onTime,
          disputesCount: v.disputes,
          updatedAt: new Date(),
        },
      });
  }

  const ALERTS = [
    { kind: "delivery_overdue", payload: { vendor: "monoprice.com", note: "USB-C Docking Station — no shipment after 7 days, escrow voided" } },
    { kind: "price_hike", payload: { vendor: "bhphotovideo.com", delta: "+8%", product: "CalDigit TS4" } },
    { kind: "better_price", payload: { product: "Logitech MX Master 3S", found: "walmart.com", saved: 700 } },
  ];
  for (const a of ALERTS) {
    await db.insert(alerts).values({ kind: a.kind, payload: a.payload }).onConflictDoNothing();
  }

  // A little agent activity so the cost chart isn't flat zero.
  const actions = [
    ["search_products", 820, 210],
    ["merchant_quote", 1140, 380],
    ["create_escrow_order", 960, 150],
    ["policy_denied", 0, 0],
    ["escrow_captured", 0, 0],
  ] as const;
  for (let i = 0; i < actions.length; i++) {
    const [action, tin, tout] = actions[i];
    await db.insert(auditLog).values({
      ts: new Date(now - (actions.length - i) * 5_400_000),
      userId: admin.id,
      actor: action.startsWith("escrow") || action === "policy_denied" ? "system" : "agent",
      action,
      input: { seeded: true },
      rationale: "seeded demo activity",
      tokensIn: tin,
      tokensOut: tout,
      costUsd: ((tin + tout) * 0.0000015).toFixed(6),
    });
  }

  const [{ c }] = await db.execute(
    sql`select count(*)::int as c from orders_local`,
  ) as unknown as { c: number }[];
  console.log(`Seeded. orders_local now has ${c} rows.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
