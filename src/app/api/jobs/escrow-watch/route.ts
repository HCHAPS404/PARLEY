import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, ensureDb } from "@/lib/db";
import { ordersLocal, alerts, reorderRules, priceWatches } from "@/lib/db/schema";
import { getOrder, createEscrowOrder } from "@/lib/paypal";
import { paypalTools } from "@/lib/paypal-toolkit";
import { searchProducts, priceHistory } from "@/lib/channel3";
import { checkPolicy } from "@/lib/policy";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

export const maxDuration = 60;

const STALE_HOURS = 24;
const EXPIRY_WARN_MS = 48 * 3600_000;

async function alertOnce(
  db: ReturnType<typeof getDb>,
  kind: string,
  payload: Record<string, unknown>,
  spaceId?: string | null,
) {
  const [existing] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.kind, kind),
        eq(alerts.status, "open"),
        sql`${alerts.payload}->>'paypalOrderId' = ${payload.paypalOrderId as string}`,
      ),
    )
    .limit(1);
  if (existing) return false;
  await db.insert(alerts).values({ kind, payload, spaceId: spaceId ?? null });
  return true;
}

/**
 * Escrow watchdog — a hold that silently expires is money the agent lost.
 * Runs on a schedule (Render cron): reconciles PayPal truth into local state,
 * flags authorizations nearing expiry, and surfaces stale unpaid orders.
 */
export async function GET(req: Request) {
  if (!env.cronSecret)
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDb();
  const db = getDb();
  // Seed rows (SEED-* ids) are dashboard fixtures, not real PayPal orders.
  const open = await db
    .select()
    .from(ordersLocal)
    .where(
      and(
        inArray(ordersLocal.status, ["created", "approved", "authorized"]),
        sql`${ordersLocal.paypalOrderId} not like 'SEED-%'`,
      ),
    );

  const now = Date.now();
  const summary = { checked: open.length, reconciled: 0, expired: 0, alerts: 0, delivered: 0, reorderProposals: 0, reordersCreated: 0, errors: 0 };

  for (const row of open) {
    try {
      const ageMs = now - (row.createdAt?.getTime() ?? 0);

      // ── 1. Reconcile: PayPal is the source of truth for money ──
      if (row.status !== "authorized" || !row.authorizationId) {
        if (ageMs < 60_000) continue; // too fresh — buyer may still be mid-approval
        const order = await getOrder(row.paypalOrderId);
        const authz = order.purchase_units?.[0]?.payments?.authorizations?.[0];
        if (authz) {
          await db
            .update(ordersLocal)
            .set({
              status: "authorized",
              authorizationId: authz.id,
              authorizationExpiresAt: authz.expiration_time
                ? new Date(authz.expiration_time)
                : null,
              updatedAt: new Date(),
            })
            .where(eq(ordersLocal.paypalOrderId, row.paypalOrderId));
          summary.reconciled++;
          continue; // handled as authorized below on next tick
        }
        if (ageMs > STALE_HOURS * 3600_000) {
          if (
            await alertOnce(db, "delivery_overdue", {
              paypalOrderId: row.paypalOrderId,
              title: row.title,
              reason: `Order ${row.status} for ${Math.round(ageMs / 3600_000)}h — buyer never completed PayPal approval`,
            }, row.spaceId)
          )
            summary.alerts++;
        }
        continue;
      }

      // ── 2. Shipment-aware escrow — the hold watches the box ──
      if (row.status === "authorized" && row.trackingNumber && row.trackingStatus !== "DELIVERED") {
        try {
          const t = paypalTools()["get_shipment_tracking"] as {
            execute?: (a: unknown) => Promise<unknown>;
          };
          const tr = (await t.execute?.({
            transaction_id: row.authorizationId,
            tracking_number: row.trackingNumber,
          })) as { status?: string } | undefined;
          const st = tr?.status ?? null;
          if (st === "DELIVERED") {
            await db
              .update(ordersLocal)
              .set({ status: "delivered", deliveredAt: new Date(), trackingStatus: st, updatedAt: new Date() })
              .where(eq(ordersLocal.paypalOrderId, row.paypalOrderId));
            if (
              await alertOnce(db, "delivered", {
                paypalOrderId: row.paypalOrderId,
                title: row.title,
                trackingNumber: row.trackingNumber,
                reason: "Carrier confirms delivery — release the escrow to pay the seller",
              }, row.spaceId)
            )
              summary.delivered++;
          } else if (st && st !== row.trackingStatus) {
            await db
              .update(ordersLocal)
              .set({ trackingStatus: st, updatedAt: new Date() })
              .where(eq(ordersLocal.paypalOrderId, row.paypalOrderId));
          }
        } catch { /* carrier lookups are best-effort */ }
      }

      // ── 3. Expired authorization — hold released back to the buyer ──
      const exp = row.authorizationExpiresAt?.getTime();
      if (exp && exp < now) {
        const order = await getOrder(row.paypalOrderId);
        const authz = order.purchase_units?.[0]?.payments?.authorizations?.[0];
        if (authz && (authz.status === "EXPIRED" || authz.status === "VOIDED")) {
          await db
            .update(ordersLocal)
            .set({ status: "expired", updatedAt: new Date() })
            .where(eq(ordersLocal.paypalOrderId, row.paypalOrderId));
          summary.expired++;
          if (
            await alertOnce(db, "delivery_overdue", {
              paypalOrderId: row.paypalOrderId,
              title: row.title,
              reason: "PayPal authorization expired uncaptured — funds released back to buyer",
            }, row.spaceId)
          )
            summary.alerts++;
        }
        continue;
      }

      // ── 3. Expiring soon — the clock is the enemy of the escrow ──
      if (exp && exp - now < EXPIRY_WARN_MS) {
        if (
          await alertOnce(db, "delivery_overdue", {
            paypalOrderId: row.paypalOrderId,
            title: row.title,
            authorizationExpiresAt: row.authorizationExpiresAt,
            reason: `Authorization expires in ${Math.round((exp - now) / 3600_000)}h — capture before PayPal releases the hold`,
          }, row.spaceId)
        )
          summary.alerts++;
      }
    } catch {
      summary.errors++;
    }
  }

  // ── 5. Autonomous procurement — due reorder rules ──
  // Inside policy + under the autonomous limit → the agent prepares the order,
  // human still approves on PayPal in one click. Anything else → proposal only.
  const rules = await db.select().from(reorderRules).where(eq(reorderRules.enabled, true));
  for (const rule of rules) {
    if (rule.lastRunAt && now - rule.lastRunAt.getTime() < rule.intervalDays * 86400_000) continue;
    try {
      const { products } = await searchProducts({ query: rule.query, limit: 5 });
      const pick = products.find(
        (p) =>
          p.bestPriceCents != null &&
          p.bestPriceCents <= rule.maxUnitPriceCents &&
          (!rule.vendorDomain || p.merchant?.includes(rule.vendorDomain)),
      );
      await db.update(reorderRules).set({ lastRunAt: new Date() }).where(eq(reorderRules.id, rule.id));
      const base = { ruleId: rule.id, query: rule.query };
      if (!pick || pick.bestPriceCents == null) {
        await alertOnce(db, "reorder_ready", {
          ...base, reason: `Nothing under $${(rule.maxUnitPriceCents / 100).toFixed(2)} this cycle`,
        }, rule.spaceId);
        continue;
      }
      const amountCents = pick.bestPriceCents * rule.quantity;
      const decision = await checkPolicy({ amountCents, vendor: pick.merchant, spaceId: rule.spaceId });
      if (!decision.allow || decision.requiresApproval) {
        await alertOnce(db, "reorder_ready", {
          ...base, title: pick.title, priceUsd: pick.bestPriceCents / 100,
          reason: !decision.allow ? decision.reason : "Above the autonomous limit — review in chat",
        }, rule.spaceId);
        summary.reorderProposals++;
        continue;
      }
      const order = await createEscrowOrder({
        amountCents,
        description: `${pick.title} x${rule.quantity} (auto-reorder)`,
        vendorName: pick.merchant,
        invoiceKey: `parley-reorder-${rule.id}-${new Date().toISOString().slice(0, 10)}`,
        returnUrl: `${env.appUrl}/api/paypal/return`,
        cancelUrl: `${env.appUrl}/api/paypal/cancel`,
      });
      const approveUrl =
        order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href ??
        `https://www.${env.paypalEnv === "live" ? "" : "sandbox."}paypal.com/checkoutnow?token=${order.id}`;
      await db.insert(ordersLocal).values({
        id: crypto.randomUUID(),
        userId: rule.userId,
        spaceId: rule.spaceId,
        paypalOrderId: order.id,
        status: "created",
        title: `${pick.title} (auto-reorder)`,
        vendor: pick.merchant ?? null,
        amountCents,
        currency: pick.currency,
        quantity: rule.quantity,
        negotiated: false,
        productSnapshot: pick,
        reorderRuleId: rule.id,
      });
      await alertOnce(db, "reorder_created", {
        ...base, paypalOrderId: order.id, title: pick.title, priceUsd: pick.bestPriceCents / 100,
        approveUrl, reason: "Inside policy and under the autonomous limit — approve on PayPal",
      }, rule.spaceId);
      summary.reordersCreated++;
    } catch {
      summary.errors++;
    }
  }

  // ── Market watches — deals and drops land in the inbox ──
  const watches = await db
    .select()
    .from(priceWatches)
    .where(eq(priceWatches.active, true));
  let watchesChecked = 0;
  for (const w of watches) {
    try {
      let latest: number | null = null;
      let matchTitle = w.title;
      let vendor: string | null = null;
      if (w.productId) {
        // Single product — real 90-day price trajectory.
        const hist = await priceHistory(w.productId, 7);
        latest = hist.points.at(-1)?.cents ?? hist.stats?.currentCents ?? null;
      } else if (w.query) {
        // Query watch — the best live offer for the whole search.
        const { products } = await searchProducts({ query: w.query, limit: 5 });
        const best = products
          .filter((p) => p.bestPriceCents != null)
          .sort((a, b) => a.bestPriceCents! - b.bestPriceCents!)[0];
        if (best?.bestPriceCents != null) {
          latest = best.bestPriceCents;
          matchTitle = best.title;
          vendor = best.merchant ?? null;
        }
      }
      watchesChecked++;
      if (latest == null) continue;
      const triggered =
        latest <= (w.thresholdCents ?? Math.round(w.baselineCents * 0.95));
      if (triggered) {
        const kind = w.query ? "deal_found" : "price_drop";
        const [existing] = await db
          .select({ id: alerts.id })
          .from(alerts)
          .where(
            and(
              eq(alerts.kind, kind),
              eq(alerts.status, "open"),
              sql`${alerts.payload}->>'watchId' = ${w.id}`,
            ),
          )
          .limit(1);
        if (!existing) {
          const dropPct = Math.round((1 - latest / w.baselineCents) * 100);
          await db.insert(alerts).values({
            kind,
            spaceId: w.spaceId,
            payload: {
              watchId: w.id,
              productId: w.productId,
              query: w.query,
              title: matchTitle,
              vendor,
              priceUsd: latest / 100,
              baselineUsd: w.baselineCents / 100,
              dropPct,
              reason: w.query
                ? `Better offer for "${w.query}" — $${(latest / 100).toFixed(2)} @ ${vendor ?? "merchant"} (was $${(w.baselineCents / 100).toFixed(2)})`
                : `${w.title} dropped ${dropPct}% — now $${(latest / 100).toFixed(2)}`,
            },
          });
          summary.alerts++;
        }
      }
      if (latest !== w.lastCents)
        await db
          .update(priceWatches)
          .set({ lastCents: latest })
          .where(eq(priceWatches.id, w.id));
    } catch {
      summary.errors++;
    }
  }

  await audit({
    actor: "system",
    action: "watchdog_run",
    output: { ...summary, watchesChecked },
    rationale: "Scheduled escrow reconciliation — PayPal truth into local state",
  });

  return NextResponse.json({ ok: true, ...summary, watchesChecked });
}
