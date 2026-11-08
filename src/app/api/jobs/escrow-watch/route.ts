import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, ensureDb } from "@/lib/db";
import { ordersLocal, alerts } from "@/lib/db/schema";
import { getOrder } from "@/lib/paypal";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

export const maxDuration = 60;

const STALE_HOURS = 24;
const EXPIRY_WARN_MS = 48 * 3600_000;

async function alertOnce(
  db: ReturnType<typeof getDb>,
  kind: string,
  payload: Record<string, unknown>,
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
  await db.insert(alerts).values({ kind, payload });
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
  const summary = { checked: open.length, reconciled: 0, expired: 0, alerts: 0, errors: 0 };

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
            })
          )
            summary.alerts++;
        }
        continue;
      }

      // ── 2. Expired authorization — hold released back to the buyer ──
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
            })
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
          })
        )
          summary.alerts++;
      }
    } catch {
      summary.errors++;
    }
  }

  await audit({
    actor: "system",
    action: "watchdog_run",
    output: summary,
    rationale: "Scheduled escrow reconciliation — PayPal truth into local state",
  });

  return NextResponse.json({ ok: true, ...summary });
}
