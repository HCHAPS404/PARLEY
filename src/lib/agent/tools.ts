import { tool } from "ai";
import { z } from "zod";
import { eq, desc, and, gt, sql } from "drizzle-orm";
import { searchProducts, type ProductCard } from "../channel3";
import {
  createEscrowOrder,
  getOrder,
  captureAuthorization,
  voidAuthorization,
} from "../paypal";
import { paypalTools } from "../paypal-toolkit";
import { checkPolicy } from "../policy";
import { audit } from "../audit";
import { getDb, ensureDb } from "../db";
import {
  ordersLocal,
  vendorScores,
  productCache as productCacheTable,
  negotiations as negotiationsTable,
} from "../db/schema";
import { merchantRound } from "./merchant";
import { rateLimit } from "../rate-limit";
import { env } from "../env";

// ─── Server-side resolution ─────────────────────────────────────────
// Prices never come from the model. They are resolved from rows the tools
// previously wrote — the agent can only *select*, never *invent*. State
// lives in Postgres so it survives restarts and turn boundaries.
const CACHE_TTL_MS = 30 * 60 * 1000;

const usd = (cents: number) => cents / 100;
const toCents = (dollars: number) => Math.round(dollars * 100);

export type AgentCtx = {
  userId: string;
  role: "admin" | "demo";
  spaceId: string;
};

type Negotiation = {
  id: string;
  productId: string;
  listPriceCents: number;
  agreedCents: number | null;
  status: "open" | "agreed" | "walked";
  transcript: { speaker: "buyer" | "merchant"; text: string }[];
};

const DEMO_SPEND_ERROR =
  "Demo accounts can search and negotiate, but cannot move funds — escrow tools are disabled.";

// Channel3 searches cost a real API key — demo users get a tight window.
const SEARCH_LIMIT: Record<AgentCtx["role"], number> = { admin: 300, demo: 20 };

/**
 * Learned reputation. Score is Bayesian-smoothed: a vendor with one on-time
 * delivery is trusted more than an unknown vendor (prior 50), but less than
 * one with ten. Disputes hit hard and linger.
 */
async function bumpVendorScore(
  db: ReturnType<typeof getDb>,
  vendor: string,
  outcome: "on_time" | "dispute",
) {
  const [v] = await db
    .select()
    .from(vendorScores)
    .where(eq(vendorScores.domain, vendor))
    .limit(1);
  const orders = (v?.ordersCount ?? 0) + 1;
  const onTime = (v?.onTimeCount ?? 0) + (outcome === "on_time" ? 1 : 0);
  const disputes = (v?.disputesCount ?? 0) + (outcome === "dispute" ? 1 : 0);
  const score = Math.max(
    0,
    Math.min(100, Math.round((100 * (onTime + 1)) / (orders + 2) - 15 * disputes)),
  );
  await db
    .insert(vendorScores)
    .values({ domain: vendor, score, ordersCount: orders, onTimeCount: onTime, disputesCount: disputes })
    .onConflictDoUpdate({
      target: vendorScores.domain,
      set: { score, ordersCount: orders, onTimeCount: onTime, disputesCount: disputes, updatedAt: new Date() },
    });
}

/** Attach learned reputation to product results so the agent can prefer trusted vendors. */
async function withVendorScores(
  db: ReturnType<typeof getDb>,
  products: ProductCard[],
) {
  const merchants = [...new Set(products.map((p) => p.merchant).filter(Boolean))] as string[];
  if (!merchants.length) return products;
  const scores = await db
    .select()
    .from(vendorScores)
    .where(sql`${vendorScores.domain} = any(${merchants})`);
  const byDomain = new Map(scores.map((s) => [s.domain, s.score]));
  return products
    .map((p) => ({ ...p, vendorScore: p.merchant ? (byDomain.get(p.merchant) ?? null) : null }))
    .sort((a, b) => (b.vendorScore ?? -1) - (a.vendorScore ?? -1));
}

async function cachePut(userId: string, p: ProductCard) {
  const db = getDb();
  await db
    .insert(productCacheTable)
    .values({
      id: p.id,
      userId,
      product: p,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    })
    .onConflictDoUpdate({
      target: productCacheTable.id,
      set: {
        userId,
        product: p,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
    });
}

async function cacheGet(userId: string, id: string): Promise<ProductCard | null> {
  const rows = await getDb()
    .select()
    .from(productCacheTable)
    .where(
      and(
        eq(productCacheTable.id, id),
        eq(productCacheTable.userId, userId),
        gt(productCacheTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return (rows[0]?.product as ProductCard) ?? null;
}

async function negGet(
  userId: string,
  spaceId: string,
  id: string,
): Promise<Negotiation | null> {
  const rows = await getDb()
    .select()
    .from(negotiationsTable)
    .where(
      and(
        eq(negotiationsTable.id, id),
        eq(negotiationsTable.userId, userId),
        eq(negotiationsTable.spaceId, spaceId),
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    productId: r.productId,
    listPriceCents: r.listPriceCents,
    agreedCents: r.agreedCents,
    status: r.status as Negotiation["status"],
    transcript: (r.transcript as Negotiation["transcript"]) ?? [],
  };
}

async function negPut(userId: string, spaceId: string, n: Negotiation) {
  await getDb()
    .insert(negotiationsTable)
    .values({
      id: n.id,
      userId,
      spaceId,
      productId: n.productId,
      listPriceCents: n.listPriceCents,
      agreedCents: n.agreedCents,
      status: n.status,
      transcript: n.transcript,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: negotiationsTable.id,
      set: {
        agreedCents: n.agreedCents,
        status: n.status,
        transcript: n.transcript,
        updatedAt: new Date(),
      },
    });
}

export function agentTools(ctx: AgentCtx) {
  return {
    search_products: tool({
      description:
        "Search a live catalog of 100M+ real products (Channel3). Use for any product discovery, price comparison, or 'find this cheaper' with imageUrl. Always call before creating orders — prices must come from here, never from memory.",
      inputSchema: z.object({
        query: z.string().optional().describe("Natural-language product search"),
        imageUrl: z
          .string()
          .url()
          .optional()
          .describe("Public image URL for visual 'find this' search"),
        maxPriceUsd: z.number().positive().optional(),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ query, imageUrl, maxPriceUsd, limit }) => {
        const rl = rateLimit(`search:${ctx.userId}`, SEARCH_LIMIT[ctx.role], 3600_000);
        if (!rl.ok) {
          await audit({
            actor: "system",
            action: "rate_limited",
            userId: ctx.userId, spaceId: ctx.spaceId,
            input: { tool: "search_products" },
            output: { retryAfterSec: rl.retryAfterSec },
          });
          return { error: `Search rate limit reached — try again in ${Math.ceil(rl.retryAfterSec / 60)} min.` };
        }
        const { products, error } = await searchProducts({
          query,
          imageUrl,
          maxPriceCents: maxPriceUsd ? toCents(maxPriceUsd) : undefined,
          limit,
        });
        await ensureDb();
        for (const p of products) await cachePut(ctx.userId, p);
        const enriched = await withVendorScores(getDb(), products);
        await audit({
          actor: "agent",
          action: "search_products",
          userId: ctx.userId, spaceId: ctx.spaceId,
          input: { query, imageUrl, maxPriceUsd },
          output: { count: products.length, error },
        });
        return { products: enriched, count: enriched.length, ...(error ? { error } : {}) };
      },
    }),

    merchant_quote: tool({
      description:
        "Negotiate price with the seller's agent (agent-to-agent). One call = one round. Returns the merchant's response and a negotiationId to keep bargaining (max 4 rounds). On 'accept', use the returned negotiationId in create_escrow_order to lock the agreed price.",
      inputSchema: z.object({
        productId: z.string().describe("Product id from search_products"),
        offerUsd: z.number().positive().describe("Your offer in USD"),
        negotiationId: z
          .string()
          .optional()
          .describe("Omit to start a new negotiation"),
      }),
      execute: async ({ productId, offerUsd, negotiationId }) => {
        await ensureDb();
        const product = await cacheGet(ctx.userId, productId);
        if (!product || product.bestPriceCents == null) {
          return { error: "Product not in search context — run search_products first" };
        }
        let session = negotiationId
          ? await negGet(ctx.userId, ctx.spaceId, negotiationId)
          : null;
        if (!session) {
          session = {
            id: crypto.randomUUID(),
            productId,
            listPriceCents: product.bestPriceCents,
            agreedCents: null,
            status: "open",
            transcript: [],
          };
          negotiationId = session.id;
        }
        if (session.status !== "open") {
          return { error: `Negotiation already ${session.status}`, negotiationId };
        }

        const offerCents = toCents(offerUsd);
        session.transcript.push({
          speaker: "buyer",
          text: `I can do $${offerUsd.toFixed(2)}.`,
        });
        const resp = merchantRound({
          listPriceCents: session.listPriceCents,
          offerCents,
          roundsUsed: session.transcript.filter((t) => t.speaker === "buyer").length,
        });
        session.transcript.push({ speaker: "merchant", text: resp.message });
        if (resp.action === "accept") {
          session.status = "agreed";
          session.agreedCents = resp.priceCents;
        } else if (resp.action === "walk") {
          session.status = "walked";
        }
        await negPut(ctx.userId, ctx.spaceId, session);
        await audit({
          actor: "merchant",
          action: "merchant_quote",
          userId: ctx.userId, spaceId: ctx.spaceId,
          input: { productId, offerUsd, negotiationId },
          output: resp,
        });
        return {
          negotiationId,
          round: session.transcript.filter((t) => t.speaker === "buyer").length,
          maxRounds: 4,
          merchantAction: resp.action,
          merchantPriceUsd: usd(resp.priceCents),
          merchantMessage: resp.message,
          status: session.status,
          transcript: session.transcript,
        };
      },
    }),

    create_escrow_order: tool({
      description:
        "Create a PayPal order that AUTHORIZES funds without capturing (agentic escrow). Money is held until delivery is confirmed. Always summarize the purchase to the user first. The price is resolved server-side from the product/negotiation — never pass amounts yourself.",
      inputSchema: z.object({
        productId: z.string().describe("Product id from search_products"),
        quantity: z.number().int().min(1).max(10).default(1),
        negotiationId: z
          .string()
          .optional()
          .describe("From an accepted merchant_quote"),
      }),
      execute: async ({ productId, quantity, negotiationId }) => {
        if (ctx.role !== "admin") {
          await audit({
            actor: "system",
            action: "demo_spend_blocked",
            userId: ctx.userId, spaceId: ctx.spaceId,
            input: { productId, quantity },
          });
          return { error: DEMO_SPEND_ERROR };
        }
        await ensureDb();
        const db = getDb();
        const product = await cacheGet(ctx.userId, productId);
        if (!product) {
          return { error: "Product not in search context — run search_products first" };
        }
        let unitCents = product.bestPriceCents;
        let negotiated = false;
        if (negotiationId) {
          const n = await negGet(ctx.userId, ctx.spaceId, negotiationId);
          if (n?.status === "agreed" && n.agreedCents != null) {
            unitCents = n.agreedCents;
            negotiated = true;
          }
        }
        if (unitCents == null) return { error: "No price available for product" };

        const amountCents = unitCents * quantity;

        // Dedup: same product+amount within 10 min → return the live order.
        const [dupe] = await db
          .select()
          .from(ordersLocal)
          .where(
            and(
              eq(ordersLocal.userId, ctx.userId),
              eq(ordersLocal.spaceId, ctx.spaceId),
              eq(ordersLocal.amountCents, amountCents),
              sql`${ordersLocal.productSnapshot}->>'id' = ${productId}`,
              sql`${ordersLocal.status} in ('created','approved','authorized')`,
              gt(ordersLocal.createdAt, new Date(Date.now() - 10 * 60 * 1000)),
            ),
          )
          .orderBy(desc(ordersLocal.createdAt))
          .limit(1);
        if (dupe) {
          return {
            allowed: true,
            orderId: dupe.paypalOrderId,
            status: dupe.status,
            approveUrl: approveUrlFor(dupe.paypalOrderId),
            holdTotalUsd: usd(amountCents),
            currency: dupe.currency,
            duplicate: true,
            escrowNote: "An identical live escrow order already exists — reusing it.",
          };
        }

        const decision = await checkPolicy({ amountCents, vendor: product.merchant, spaceId: ctx.spaceId });
        if (!decision.allow) {
          await audit({
            actor: "system",
            action: "policy_denied",
            userId: ctx.userId, spaceId: ctx.spaceId,
            input: { productId, quantity, amountCents },
            output: decision,
          });
          return { allowed: false, reason: decision.reason };
        }

        const order = await createEscrowOrder({
          amountCents,
          description: `${product.title} x${quantity}`,
          vendorName: product.merchant,
          returnUrl: `${env.appUrl}/api/paypal/return`,
          cancelUrl: `${env.appUrl}/api/paypal/cancel`,
        });
        const approveUrl =
          order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")
            ?.href ?? approveUrlFor(order.id);

        await db.insert(ordersLocal).values({
          id: crypto.randomUUID(),
          userId: ctx.userId, spaceId: ctx.spaceId,
          paypalOrderId: order.id,
          status: "created",
          title: product.title,
          vendor: product.merchant ?? null,
          amountCents,
          currency: product.currency,
          quantity,
          agreedPriceCents: negotiated ? unitCents : null,
          negotiated,
          productSnapshot: product,
        });
        await audit({
          actor: "agent",
          action: "create_escrow_order",
          userId: ctx.userId, spaceId: ctx.spaceId,
          input: { productId, quantity, negotiationId },
          output: { orderId: order.id, status: order.status },
          rationale: decision.reason,
        });
        return {
          allowed: true,
          orderId: order.id,
          status: order.status,
          approveUrl,
          holdTotalUsd: usd(amountCents),
          currency: product.currency,
          escrowNote:
            "Funds are authorized (held), not charged — released to the seller only after delivery is confirmed.",
          policyReason: decision.reason,
        };
      },
    }),

    confirm_delivery_release: tool({
      description:
        "Confirm delivery and release the escrowed authorization to the seller (captures the hold). In production this fires from PayPal Shipment Tracking; in the demo it simulates that confirmation.",
      inputSchema: z.object({
        paypalOrderId: z.string().describe("The PayPal order id"),
      }),
      execute: async ({ paypalOrderId }) => {
        if (ctx.role !== "admin") return { error: DEMO_SPEND_ERROR };
        await ensureDb();
        const db = getDb();
        const [row] = await db
          .select()
          .from(ordersLocal)
          .where(
            and(
              eq(ordersLocal.paypalOrderId, paypalOrderId),
              eq(ordersLocal.userId, ctx.userId),
              eq(ordersLocal.spaceId, ctx.spaceId),
            ),
          )
          .limit(1);
        if (!row) return { error: "Order not found" };

        let authId = row.authorizationId;
        if (!authId) {
          const order = await getOrder(paypalOrderId);
          authId =
            order.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ?? null;
          if (!authId) {
            return {
              error: `No authorization on order (status: ${order.status}) — buyer may not have approved it yet`,
            };
          }
        }
        const capture = await captureAuthorization(authId);
        await db
          .update(ordersLocal)
          .set({ status: "captured", deliveredAt: new Date(), updatedAt: new Date() })
          .where(eq(ordersLocal.paypalOrderId, paypalOrderId));
        if (row.vendor) await bumpVendorScore(db, row.vendor, "on_time");
        await audit({
          actor: "system",
          action: "escrow_captured",
          userId: ctx.userId, spaceId: ctx.spaceId,
          input: { paypalOrderId, authId },
          output: capture,
          rationale: "Delivery confirmed — hold released to seller",
        });
        return {
          status: capture.status,
          captureId: capture.id,
          releasedUsd: usd(row.amountCents),
          note: "Escrow released — seller paid on confirmed delivery.",
        };
      },
    }),

    void_escrow_order: tool({
      description:
        "Void the escrow hold — goods never arrived or the deal fell through. The authorized funds go back to the buyer untouched.",
      inputSchema: z.object({
        paypalOrderId: z.string().describe("The PayPal order id"),
        reason: z.string().optional().describe("Why the hold is being voided"),
      }),
      execute: async ({ paypalOrderId, reason }) => {
        if (ctx.role !== "admin") return { error: DEMO_SPEND_ERROR };
        await ensureDb();
        const db = getDb();
        const [row] = await db
          .select()
          .from(ordersLocal)
          .where(
            and(
              eq(ordersLocal.paypalOrderId, paypalOrderId),
              eq(ordersLocal.userId, ctx.userId),
              eq(ordersLocal.spaceId, ctx.spaceId),
            ),
          )
          .limit(1);
        if (!row) return { error: "Order not found" };
        if (row.status === "captured")
          return { error: "Order already captured — funds already released to the seller" };
        if (row.status === "voided") return { status: "voided", note: "Already voided." };

        let authId = row.authorizationId;
        if (!authId) {
          const order = await getOrder(paypalOrderId);
          authId =
            order.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ?? null;
          if (!authId) {
            // No authorization to void — just close the local order.
            await db
              .update(ordersLocal)
              .set({ status: "voided", updatedAt: new Date() })
              .where(eq(ordersLocal.paypalOrderId, paypalOrderId));
            return {
              status: "voided",
              note: "No authorization existed — nothing held, order closed locally.",
            };
          }
        }
        const voided = await voidAuthorization(authId);
        await db
          .update(ordersLocal)
          .set({ status: "voided", updatedAt: new Date() })
          .where(eq(ordersLocal.paypalOrderId, paypalOrderId));
        if (row.vendor) await bumpVendorScore(db, row.vendor, "dispute");
        await audit({
          actor: "system",
          action: "escrow_voided",
          userId: ctx.userId, spaceId: ctx.spaceId,
          input: { paypalOrderId, authId, reason },
          output: voided,
          rationale: reason ?? "Delivery failed or deal abandoned — hold returned to buyer",
        });
        return {
          status: voided.status,
          releasedUsd: usd(row.amountCents),
          note: "Escrow voided — authorized funds released back to the buyer.",
        };
      },
    }),

    get_escrow_status: tool({
      description: "Check the live PayPal status of an escrow order.",
      inputSchema: z.object({ paypalOrderId: z.string() }),
      execute: async ({ paypalOrderId }) => {
        await ensureDb();
        const [row] = await getDb()
          .select()
          .from(ordersLocal)
          .where(
            and(
              eq(ordersLocal.paypalOrderId, paypalOrderId),
              eq(ordersLocal.userId, ctx.userId),
              eq(ordersLocal.spaceId, ctx.spaceId),
            ),
          )
          .limit(1);
        if (!row) return { error: "Order not found" };
        const order = await getOrder(paypalOrderId);
        const payments = order.purchase_units?.[0]?.payments;
        return {
          orderId: order.id,
          status: order.status,
          authorizationId: payments?.authorizations?.[0]?.id ?? null,
          captured: (payments?.captures ?? []).length > 0,
        };
      },
    }),

    list_orders: tool({
      description: "List your recent escrow orders from the local store.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
      execute: async ({ limit }) => {
        await ensureDb();
        const rows = await getDb()
          .select()
          .from(ordersLocal)
          .where(
            and(
              eq(ordersLocal.userId, ctx.userId),
              eq(ordersLocal.spaceId, ctx.spaceId),
            ),
          )
          .orderBy(desc(ordersLocal.createdAt))
          .limit(limit);
        return {
          orders: rows.map((r) => ({
            id: r.paypalOrderId,
            title: r.title,
            vendor: r.vendor,
            totalUsd: usd(r.amountCents),
            currency: r.currency,
            status: r.status,
            negotiated: r.negotiated,
            createdAt: r.createdAt,
          })),
        };
      },
    }),

    // Merchant-account tools (invoices, disputes, transactions) are admin-only —
    // they read and write the workspace owner's PayPal account.
    ...(ctx.role === "admin" ? paypalTools() : {}),
  };
}

function approveUrlFor(orderId: string) {
  const host =
    env.paypalEnv === "live" ? "www.paypal.com" : "www.sandbox.paypal.com";
  return `https://${host}/checkoutnow?token=${orderId}`;
}
