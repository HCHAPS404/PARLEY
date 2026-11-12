import { tool } from "ai";
import { z } from "zod";
import { eq, desc, and, gt, sql, inArray } from "drizzle-orm";
import {
  searchProducts,
  priceHistory,
  startPriceTracking,
  countSimilar,
  type ProductCard,
} from "../channel3";
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
  reorderRules,
  sellerProducts,
  merchantProfiles,
  priceWatches,
  users,
} from "../db/schema";
import { merchantAgentRound } from "./merchant";
import { recordSellerInteraction, repeatDealsFor } from "../relationships";
import { activeCampaignFor, activeCampaignsMap, promoPriceCents } from "../campaigns";
import { rateLimit } from "../rate-limit";
import { recordPricePoint } from "../price-trace";
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
  role: "admin" | "user" | "demo";
  spaceId: string;
  /** Image the user attached this turn — visual search consumes it, the model never re-uploads bytes. */
  lastImage?: { base64: string; mediaType: string };
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
const SEARCH_LIMIT: Record<AgentCtx["role"], number> = {
  admin: 300,
  user: 100,
  demo: 20,
};

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
  // Reputation enriches results — it must never kill the search itself.
  let scores: { domain: string; score: number }[];
  try {
    scores = await db
      .select({ domain: vendorScores.domain, score: vendorScores.score })
      .from(vendorScores)
      .where(inArray(vendorScores.domain, merchants));
  } catch {
    return products;
  }
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
        "Search a live catalog of 100M+ real products (Channel3). Use for any product discovery, price comparison, or 'find this cheaper'. When the user attached an image this turn it's used automatically — add a text query to refine. Always call before creating orders — prices must come from here, never from memory.",
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
          base64Image: imageUrl ? undefined : ctx.lastImage?.base64,
          maxPriceCents: maxPriceUsd ? toCents(maxPriceUsd) : undefined,
          limit,
        });
        await ensureDb();
        // Parley market: items listed by other users' merchant agents join the
        // catalog as vendors — buying from them negotiates with a real agent.
        if (query) {
          const db = getDb();
          const mine = await db
            .select({
              id: sellerProducts.id,
              title: sellerProducts.title,
              priceCents: sellerProducts.priceCents,
              currency: sellerProducts.currency,
              image: sellerProducts.image,
              description: sellerProducts.description,
              sellerName: merchantProfiles.displayName,
              sellerUserId: sellerProducts.userId,
            })
            .from(sellerProducts)
            .innerJoin(merchantProfiles, eq(merchantProfiles.userId, sellerProducts.userId))
            .where(sql`${sellerProducts.title} ilike ${"%" + query.slice(0, 60) + "%"}`)
            .limit(3);
          for (const m of mine) {
            if (m.sellerUserId === ctx.userId) continue; // don't sell to yourself
            // An active seller campaign advertises its promo price to buyers —
            // the merchant agent then floors negotiation at that same price.
            const { byProduct, global } = await activeCampaignsMap(m.sellerUserId);
            const camp = byProduct.get(m.id) ?? global;
            const priceCents = camp
              ? promoPriceCents(m.priceCents, camp.pctOff)
              : m.priceCents;
            products.push({
              id: m.id, title: m.title, brand: "Parley seller",
              bestPriceCents: priceCents, currency: m.currency,
              image: m.image ?? undefined,
              ...(m.description ? { description: m.description } : {}),
              merchant: m.sellerName, offersCount: 1,
              offers: [{ domain: m.sellerName, priceCents, currency: m.currency, url: "" }],
              ...(camp ? { promo: `${camp.name} −${camp.pctOff}%` } : {}),
            });
          }
        }
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
        // A2A over a real protocol boundary when MCP_SECRET is set: the buyer
        // calls the merchant agent's JSON-RPC service over HTTP. In-process
        // call remains as fallback (and for devs without the secret).
        const sellerProfile = await sellerProfileFor(productId);
        const roundArgs = {
          listPriceCents: session.listPriceCents,
          offerCents,
          roundsUsed: session.transcript.filter((t) => t.speaker === "buyer").length,
          productId,
          productTitle: product.title,
          floorRatioPct: sellerProfile?.floorRatioPct,
          style: sellerProfile?.style,
          sellerName: sellerProfile?.displayName,
        };
        let buyerEmail: string | undefined;
        if (sellerProfile) {
          const [me] = await getDb()
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, ctx.userId))
            .limit(1);
          buyerEmail = me?.email;
        }
        const resp = await negotiate({
          ...roundArgs,
          merchantId: sellerProfile?.id,
          buyerLabel: `parley-user-${ctx.userId.slice(0, 8)}`,
          buyerEmail,
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
          merchantName: sellerProfile?.displayName ?? "Merchant",
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
        if (ctx.role === "demo") {
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
          // Deterministic invoice: same buyer + product + amount + day →
          // PayPal rejects a retried create as DUPLICATE_INVOICE_ID.
          invoiceKey: `parley-${ctx.userId.slice(0, 8)}-${productId.slice(0, 40)}-${amountCents}-${new Date().toISOString().slice(0, 10)}`,
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
          negotiationId: negotiated ? negotiationId : null,
          productSnapshot: product,
        });
        // Buying from a Parley seller → link the escrow to their sale ledger
        // and log the paid-price point on their side of the trace.
        if (productId.startsWith("sp_")) {
          await db.execute(sql`
            update merchant_sales set buyer_order_id = ${order.id}
            where id = (
              select ms.id from merchant_sales ms
              join seller_products sp on sp.user_id = ms.seller_user_id
              where sp.id = ${productId} and ms.buyer_order_id is null
              order by ms.created_at desc limit 1
            )`);
          const [sp] = await db
            .select({ sellerUserId: sellerProducts.userId })
            .from(sellerProducts)
            .where(eq(sellerProducts.id, productId))
            .limit(1);
          if (sp) {
            await recordPricePoint({
              userId: sp.sellerUserId, sellerUserId: sp.sellerUserId,
              vendorDomain: product.merchant ?? null, title: product.title,
              cents: unitCents, kind: "paid", orderId: order.id,
            });
          }
        }
        // The buyer's trace: sticker today vs what the agent actually closed.
        await recordPricePoint({
          userId: ctx.userId, spaceId: ctx.spaceId,
          vendorDomain: product.merchant ?? null, title: product.title,
          cents: product.bestPriceCents ?? unitCents, kind: "list", orderId: order.id,
        });
        if (negotiated) {
          await recordPricePoint({
            userId: ctx.userId, spaceId: ctx.spaceId,
            vendorDomain: product.merchant ?? null, title: product.title,
            cents: unitCents, kind: "paid", orderId: order.id,
          });
        }
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
        if (ctx.role === "demo") return { error: DEMO_SPEND_ERROR };
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
        if (paypalOrderId.startsWith("SEED-"))
          return {
            error:
              "Demo fixture — staged order with no live PayPal authorization behind it. " +
              "Release only applies to an order actually purchased and approved through PayPal.",
          };

        try {
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
        } catch (e) {
          return {
            error: `PayPal request failed — ${e instanceof Error ? e.message.slice(0, 160) : "unknown error"}`,
          };
        }
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
        if (ctx.role === "demo") return { error: DEMO_SPEND_ERROR };
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
        if (paypalOrderId.startsWith("SEED-"))
          return {
            error:
              "Demo fixture — staged order with no live PayPal authorization behind it. " +
              "Void only applies to an order actually purchased and approved through PayPal.",
          };

        try {
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
        } catch (e) {
          return {
            error: `PayPal request failed — ${e instanceof Error ? e.message.slice(0, 160) : "unknown error"}`,
          };
        }
      },
    }),

    release_partial: tool({
      description:
        "Release part of the escrow — partial delivery confirmed (e.g. 3 of 5 boxes arrived). Releases a percentage or amount of the hold; the rest stays held until the remainder arrives.",
      inputSchema: z.object({
        paypalOrderId: z.string(),
        percent: z.number().min(1).max(100).optional().describe("Percent of the hold to release"),
        amountUsd: z.number().positive().optional().describe("Exact amount to release instead"),
        finalCapture: z.boolean().default(false).describe("True releases this and ends the hold"),
      }),
      execute: async ({ paypalOrderId, percent, amountUsd, finalCapture }) => {
        if (ctx.role === "demo") return { error: DEMO_SPEND_ERROR };
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
        if (["captured", "voided", "cancelled", "failed"].includes(row.status))
          return { error: `Order already ${row.status} — nothing to release` };
        if (paypalOrderId.startsWith("SEED-"))
          return {
            error:
              "Demo fixture — staged order with no live PayPal authorization behind it. " +
              "Release only applies to an order actually purchased and approved through PayPal.",
          };
        const held = row.amountCents - (row.capturedCents ?? 0);
        const releaseCents = amountUsd
          ? toCents(amountUsd)
          : Math.round(row.amountCents * ((percent ?? 100) / 100));
        if (releaseCents <= 0 || releaseCents > held)
          return { error: `Release must be between $0.01 and the remaining hold $${(held / 100).toFixed(2)}` };
        const isFinal = finalCapture || releaseCents >= held;
        try {
          let authId = row.authorizationId;
          if (!authId) {
            const order = await getOrder(paypalOrderId);
            authId = order.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ?? null;
            if (!authId) return { error: "No authorization hold on this order" };
          }
          const cap = await captureAuthorization(authId, {
            amountCents: releaseCents,
            currency: row.currency,
            finalCapture: isFinal,
          });
          const newCaptured = (row.capturedCents ?? 0) + releaseCents;
          await db
            .update(ordersLocal)
            .set({
              capturedCents: newCaptured,
              status: isFinal ? "captured" : row.status,
              updatedAt: new Date(),
            })
            .where(eq(ordersLocal.paypalOrderId, paypalOrderId));
          if (isFinal && row.vendor) await bumpVendorScore(db, row.vendor, "on_time");
          await audit({
            actor: "system",
            action: "escrow_partial_release",
            userId: ctx.userId, spaceId: ctx.spaceId,
            input: { paypalOrderId, releaseCents, finalCapture: isFinal },
            output: cap,
            rationale: "Partial delivery — release proportional to what arrived",
          });
          return {
            releasedUsd: usd(releaseCents),
            remainingHeldUsd: usd(row.amountCents - newCaptured),
            status: isFinal ? "captured" : "partial",
            captureId: cap.id,
          };
        } catch (e) {
          return {
            error: `PayPal request failed — ${e instanceof Error ? e.message.slice(0, 160) : "unknown error"}`,
          };
        }
      },
    }),

    run_rfq: tool({
      description:
        "Request-for-quotation: send the same purchase need to multiple merchant agents in parallel and rank their sealed quotes — real procurement, not single-vendor haggling. The winning quote persists as an accepted negotiation you can buy via create_escrow_order.",
      inputSchema: z.object({
        productId: z.string().describe("Product id from search_products — quotes run per vendor offer"),
        offerUsd: z.number().positive().describe("Your opening offer to each vendor"),
      }),
      execute: async ({ productId, offerUsd }) => {
        await ensureDb();
        const product = await cacheGet(ctx.userId, productId);
        if (!product || product.bestPriceCents == null)
          return { error: "Product not in search context — run search_products first" };
        const vendors = (product.offers.length ? product.offers : [{ domain: product.merchant ?? "vendor", priceCents: product.bestPriceCents }]).slice(0, 3);
        const offerCents = toCents(offerUsd);
        const quotes = await Promise.all(
          vendors.map(async (v) => {
            const resp = await negotiate({
              productId, productTitle: product.title,
              listPriceCents: v.priceCents, offerCents, roundsUsed: 1,
            });
            return { vendor: v.domain, listUsd: usd(v.priceCents), action: resp.action, quoteUsd: usd(resp.priceCents), quoteCents: resp.priceCents, message: resp.message };
          }),
        );
        const winner = quotes
          .filter((q) => q.action !== "walk")
          .sort((a, b) => a.quoteCents - b.quoteCents)[0] ?? null;
        // Persist the winning quote as an accepted negotiation — create_escrow_order honors it.
        let negotiationId: string | null = null;
        if (winner) {
          const session = {
            id: crypto.randomUUID(),
            productId,
            listPriceCents: product.bestPriceCents,
            agreedCents: winner.quoteCents,
            status: "agreed" as const,
            transcript: [
              { speaker: "buyer" as const, text: `RFQ to ${quotes.length} vendors — I can do $${offerUsd.toFixed(2)}.` },
              { speaker: "merchant" as const, text: `[${winner.vendor}] ${winner.message}` },
            ],
          };
          await negPut(ctx.userId, ctx.spaceId, session);
          negotiationId = session.id;
        }
        await audit({
          actor: "agent", action: "run_rfq",
          userId: ctx.userId, spaceId: ctx.spaceId,
          input: { productId, offerUsd, vendors: vendors.map((v) => v.domain) },
          output: { quotes: quotes.map((q) => ({ vendor: q.vendor, action: q.action, quoteUsd: q.quoteUsd })) },
          rationale: "Sealed-bid quotation across merchants — best quote wins",
        });
        return { quotes, winner: winner?.vendor ?? null, negotiationId };
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

    register_tracking: tool({
      description:
        "Attach carrier tracking to an escrow order — the watchdog then watches the shipment and flags the moment it arrives, so payment releases only on confirmed delivery.",
      inputSchema: z.object({
        paypalOrderId: z.string(),
        trackingNumber: z.string(),
        carrier: z.string().describe("Carrier code — UPS, USPS, FEDEX, DHL…"),
      }),
      execute: async ({ paypalOrderId, trackingNumber, carrier }) => {
        if (ctx.role === "demo") return { error: DEMO_SPEND_ERROR };
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
        const carrierCode = carrier.toUpperCase().replace(/\s+/g, "_");
        // Register on PayPal's side too — best effort (sandbox carriers vary).
        let note = "saved locally";
        try {
          const t = paypalTools()["create_shipment_tracking"] as {
            execute?: (a: unknown) => Promise<unknown>;
          };
          await t.execute?.({
            transaction_id: row.authorizationId ?? paypalOrderId,
            tracking_number: trackingNumber,
            carrier: carrierCode,
            status: "SHIPPED",
          });
          note = "registered with PayPal";
        } catch { /* local tracking still works via watchdog */ }
        await db
          .update(ordersLocal)
          .set({ trackingNumber, carrier: carrierCode, trackingStatus: "SHIPPED", updatedAt: new Date() })
          .where(eq(ordersLocal.paypalOrderId, paypalOrderId));
        await audit({
          actor: "agent", action: "tracking_registered",
          userId: ctx.userId, spaceId: ctx.spaceId,
          input: { paypalOrderId, trackingNumber, carrier: carrierCode },
          output: { note },
          rationale: "Shipment-aware escrow — watchdog polls the carrier until DELIVERED",
        });
        return {
          status: "tracking", trackingNumber, carrier: carrierCode,
          note: `Escrow now watches this shipment (${note}) — release is flagged the moment it lands.`,
        };
      },
    }),

    request_invoice: tool({
      description:
        "Ask the merchant to issue a formal PayPal invoice for an escrow order — the paper trail for the books. Creates and sends it to the billing email.",
      inputSchema: z.object({
        paypalOrderId: z.string(),
        recipientEmail: z.string().email().describe("Billing email the invoice is addressed to"),
      }),
      execute: async ({ paypalOrderId, recipientEmail }) => {
        if (ctx.role === "demo") return { error: DEMO_SPEND_ERROR };
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
        if (row.invoiceId) return { invoiceId: row.invoiceId, note: "Invoice already issued for this order." };
        try {
          const tools = paypalTools() as Record<string, { execute?: (a: unknown) => Promise<unknown> }>;
          const numRes = (await tools["generate_invoice_number"]?.execute?.({})) as { invoice_number?: string } | undefined;
          const invoiceNumber = numRes?.invoice_number;
          const value = (row.amountCents / 100).toFixed(2);
          const created = (await tools["create_invoice"]?.execute?.({
            detail: {
              invoice_number: invoiceNumber,
              currency_code: row.currency ?? "USD",
              note: `Parley procurement — escrow order ${paypalOrderId}`,
              payment_term: { term_type: "DUE_ON_RECEIPT" },
            },
            primary_recipients: [{ billing_info: { email_address: recipientEmail } }],
            items: [{
              name: row.title.slice(0, 127),
              quantity: String(row.quantity ?? 1),
              unit_amount: { currency_code: row.currency ?? "USD", value },
            }],
            amount: { breakdown: { item_total: { currency_code: row.currency ?? "USD", value: (row.amountCents * (row.quantity ?? 1) / 100).toFixed(2) } } },
          })) as { id?: string } | undefined;
          const invoiceId = created?.id;
          if (!invoiceId) return { error: "PayPal did not return an invoice id" };
          await tools["send_invoice"]?.execute?.({ invoice_id: invoiceId });
          await db
            .update(ordersLocal)
            .set({ invoiceId, updatedAt: new Date() })
            .where(eq(ordersLocal.paypalOrderId, paypalOrderId));
          await audit({
            actor: "merchant", action: "invoice_issued",
            userId: ctx.userId, spaceId: ctx.spaceId,
            input: { paypalOrderId, recipientEmail },
            output: { invoiceId, invoiceNumber },
            rationale: "Formal invoice for the escrowed purchase — procurement paper trail",
          });
          return { invoiceId, invoiceNumber, status: "sent", note: "Invoice issued and sent by the merchant." };
        } catch (e) {
          return { error: `Invoice failed: ${e instanceof Error ? e.message : String(e)}` };
        }
      },
    }),

    create_reorder_rule: tool({
      description:
        "Autonomous procurement: set a recurring reorder rule (e.g. 'reorder shipping boxes every 30 days under $25'). The watchdog checks it on schedule, searches, applies policy, and prepares the order — human approves on PayPal.",
      inputSchema: z.object({
        query: z.string().describe("What to reorder, as a search query"),
        maxUnitPriceUsd: z.number().positive().describe("Never buy above this unit price"),
        intervalDays: z.number().int().min(1).max(365).default(30),
        quantity: z.number().int().min(1).max(10).default(1),
        vendorDomain: z.string().optional().describe("Pin to a specific vendor"),
      }),
      execute: async ({ query, maxUnitPriceUsd, intervalDays, quantity, vendorDomain }) => {
        if (ctx.role === "demo") return { error: DEMO_SPEND_ERROR };
        await ensureDb();
        const rule = {
          id: `rule_${crypto.randomUUID().slice(0, 8)}`,
          userId: ctx.userId,
          spaceId: ctx.spaceId,
          query,
          vendorDomain: vendorDomain ?? null,
          quantity,
          maxUnitPriceCents: toCents(maxUnitPriceUsd),
          intervalDays,
          enabled: true,
        };
        await getDb().insert(reorderRules).values(rule);
        await audit({
          actor: "user", action: "reorder_rule_created",
          userId: ctx.userId, spaceId: ctx.spaceId,
          input: rule,
          rationale: "Recurring procurement — agent reorders within policy, human approves",
        });
        return { ruleId: rule.id, status: "armed", everyDays: intervalDays, maxUsd: maxUnitPriceUsd };
      },
    }),

    list_reorder_rules: tool({
      description: "List your active reorder rules.",
      inputSchema: z.object({}),
      execute: async () => {
        await ensureDb();
        const rows = await getDb()
          .select()
          .from(reorderRules)
          .where(
            and(
              eq(reorderRules.userId, ctx.userId),
              eq(reorderRules.spaceId, ctx.spaceId),
            ),
          );
        return {
          rules: rows.map((r) => ({
            id: r.id, query: r.query, quantity: r.quantity,
            maxUsd: usd(r.maxUnitPriceCents), intervalDays: r.intervalDays,
            enabled: r.enabled, lastRunAt: r.lastRunAt,
          })),
        };
      },
    }),

    market_report: tool({
      description:
        "Market intelligence for a product idea — real catalog depth (how many merchants carry it), cross-merchant price spread, vendor reliability, and the benchmark product's true 90-day price trajectory. Use for 'what should I sell', 'is X trending', product-selection and dropshipping questions — answers demand questions with live data, not vibes.",
      inputSchema: z.object({
        query: z.string().describe("Product or niche to analyze"),
        limit: z.number().int().min(3).max(10).default(6),
      }),
      execute: async ({ query, limit }) => {
        const rl = rateLimit(`search:${ctx.userId}`, SEARCH_LIMIT[ctx.role], 3600_000);
        if (!rl.ok)
          return { error: `Search rate limit reached — try again in ${Math.ceil(rl.retryAfterSec / 60)} min.` };
        const { products, error } = await searchProducts({ query, limit });
        if (!products.length)
          return { error: error ?? "No market data for that query" };
        await ensureDb();
        for (const p of products) await cachePut(ctx.userId, p);
        const enriched = await withVendorScores(getDb(), products);
        const merchants = [
          ...new Set(products.map((p) => p.merchant).filter(Boolean)),
        ];
        const prices = products
          .map((p) => p.bestPriceCents)
          .filter((c): c is number => c != null)
          .sort((a, b) => a - b);
        const top = enriched[0];
        const [hist, similar] = await Promise.all([
          priceHistory(top.id, 90),
          countSimilar(top.id),
        ]);
        const first = hist.points[0]?.cents;
        const last = hist.points.at(-1)?.cents;
        const trendPct =
          first && last ? Math.round(((last - first) / first) * 100) : null;
        await audit({
          actor: "agent",
          action: "market_report",
          userId: ctx.userId,
          spaceId: ctx.spaceId,
          input: { query },
          output: { merchants: merchants.length, trendPct },
          rationale: "Market intelligence — demand priced from live data",
        });
        return {
          query,
          sampleSize: products.length,
          merchantCount: merchants.length,
          priceRangeUsd: prices.length
            ? {
                min: usd(prices[0]),
                median: usd(prices[Math.floor(prices.length / 2)]),
                max: usd(prices.at(-1)!),
              }
            : null,
          alternativesCount: similar,
          benchmarkProduct: {
            id: top.id,
            title: top.title,
            merchant: top.merchant,
            priceUsd: top.bestPriceCents != null ? usd(top.bestPriceCents) : null,
          },
          priceTrend90d: hist.stats
            ? {
                currentUsd: usd(hist.stats.currentCents),
                meanUsd: usd(hist.stats.meanCents),
                minUsd: usd(hist.stats.minCents),
                maxUsd: usd(hist.stats.maxCents),
                trendPct,
                status: hist.stats.status,
                dataPoints: hist.points.length,
              }
            : null,
          sparkPoints: hist.points.map((p) => p.cents),
          products: enriched,
        };
      },
    }),

    track_price: tool({
      description:
        "Arm a market watch — the watchdog then polls Channel3 and alerts the Inbox on a drop. Two modes: productId watches one product's price history (≥5% or under your target); query watches a whole search for a better offer appearing. Set-and-forget deal tracking.",
      inputSchema: z.object({
        productId: z
          .string()
          .optional()
          .describe("Product id from search_products or market_report — watch this item"),
        query: z
          .string()
          .optional()
          .describe("Search query — alert when a better offer appears for it"),
        alertBelowUsd: z
          .number()
          .positive()
          .optional()
          .describe("Alert when the price falls under this"),
      }),
      execute: async ({ productId, query, alertBelowUsd }) => {
        if (!productId && !query)
          return { error: "Pass a productId (watch one item) or a query (watch the market)" };
        if (productId && query)
          return { error: "Pick one — product watch or query watch, not both" };
        await ensureDb();
        const db = getDb();
        const active = await db
          .select({ productId: priceWatches.productId, query: priceWatches.query })
          .from(priceWatches)
          .where(
            and(
              eq(priceWatches.userId, ctx.userId),
              eq(priceWatches.spaceId, ctx.spaceId),
              eq(priceWatches.active, true),
            ),
          );
        const cap = ctx.role === "admin" ? 25 : ctx.role === "user" ? 10 : 3;
        if (active.length >= cap)
          return { error: `Watch limit reached (${cap}) — stop a watch first` };

        let title: string;
        let baselineCents: number;
        let currency = "USD";
        if (productId) {
          if (active.some((w) => w.productId === productId))
            return { error: "Already watching this product" };
          const product = await cacheGet(ctx.userId, productId);
          if (!product || product.bestPriceCents == null)
            return { error: "Product not in search context — run search_products first" };
          title = product.title;
          baselineCents = product.bestPriceCents;
          currency = product.currency;
          void startPriceTracking(productId);
        } else {
          const q = query!;
          if (active.some((w) => w.query === q))
            return { error: "Already watching that query" };
          // Search now to pin the baseline — and prove the query yields offers.
          const { products, error } = await searchProducts({ query: q, limit: 5 });
          if (error) return { error };
          const best = products
            .map((p) => p.bestPriceCents)
            .filter((c): c is number => c != null)
            .sort((a, b) => a - b)[0];
          if (best == null)
            return { error: "No offers for that query — nothing to watch yet" };
          title = q;
          baselineCents = best;
        }

        const id = `pw_${crypto.randomUUID().slice(0, 8)}`;
        await db.insert(priceWatches).values({
          id,
          userId: ctx.userId,
          spaceId: ctx.spaceId,
          productId: productId ?? null,
          query: query ?? null,
          title,
          baselineCents,
          thresholdCents: alertBelowUsd ? toCents(alertBelowUsd) : null,
          lastCents: baselineCents,
          currency,
        });
        await audit({
          actor: "agent",
          action: "price_watch_armed",
          userId: ctx.userId,
          spaceId: ctx.spaceId,
          input: { productId, query, alertBelowUsd },
          output: { watchId: id },
          rationale: "Watchdog polls the market for a better deal",
        });
        return {
          watchId: id,
          title,
          watchingFromUsd: usd(baselineCents),
          alertBelowUsd: alertBelowUsd ?? null,
          note: "The watchdog checks the market — a better deal lands in your Inbox.",
        };
      },
    }),

    list_price_watches: tool({
      description: "List active price watches and the last seen price vs baseline.",
      inputSchema: z.object({}),
      execute: async () => {
        await ensureDb();
        const rows = await getDb()
          .select()
          .from(priceWatches)
          .where(
            and(
              eq(priceWatches.userId, ctx.userId),
              eq(priceWatches.spaceId, ctx.spaceId),
              eq(priceWatches.active, true),
            ),
          );
        return {
          watches: rows.map((w) => ({
            id: w.id,
            kind: w.query ? "query" : "product",
            title: w.title,
            baselineUsd: usd(w.baselineCents),
            lastUsd: w.lastCents != null ? usd(w.lastCents) : null,
            alertBelowUsd: w.thresholdCents != null ? usd(w.thresholdCents) : null,
            currency: w.currency,
          })),
        };
      },
    }),

    stop_price_watch: tool({
      description: "Disarm a price watch by its watch id.",
      inputSchema: z.object({ watchId: z.string() }),
      execute: async ({ watchId }) => {
        await ensureDb();
        const db = getDb();
        const [w] = await db
          .select({ id: priceWatches.id })
          .from(priceWatches)
          .where(
            and(
              eq(priceWatches.id, watchId),
              eq(priceWatches.userId, ctx.userId),
              eq(priceWatches.spaceId, ctx.spaceId),
            ),
          )
          .limit(1);
        if (!w) return { error: "Watch not found" };
        await db
          .update(priceWatches)
          .set({ active: false })
          .where(eq(priceWatches.id, watchId));
        return { stopped: watchId };
      },
    }),

    // Merchant-account tools (invoices, disputes, transactions) are admin-only —
    // they read and write the workspace owner's PayPal account.
    ...(ctx.role === "admin" ? paypalTools() : {}),
  };
}

/** A product id `sp_*` belongs to a Parley seller — resolve their agent config. */
async function sellerProfileFor(productId: string) {
  if (!productId.startsWith("sp_")) return null;
  const db = getDb();
  const [sp] = await db
    .select({ userId: sellerProducts.userId })
    .from(sellerProducts)
    .where(eq(sellerProducts.id, productId))
    .limit(1);
  if (!sp) return null;
  const [p] = await db
    .select()
    .from(merchantProfiles)
    .where(eq(merchantProfiles.userId, sp.userId))
    .limit(1);
  return p ?? null;
}

/**
 * One place owns the A2A transport: MCP-over-HTTP when the secret is set,
 * in-process agent otherwise — with fallback either way.
 */
async function negotiate(
  args: Parameters<typeof merchantAgentRound>[0] & {
    merchantId?: string;
    buyerLabel?: string;
    buyerEmail?: string;
  },
) {
  const { merchantId, buyerLabel, buyerEmail, ...round } = args;
  const inProcess = async () => {
    const terms = await sellerTerms(round);
    // Loyalty context travels with the round — the merchant weighs repeat buyers.
    const sellerUserId = await sellerUserFor(round.productId);
    const repeatDeals = sellerUserId ? await repeatDealsFor(sellerUserId, buyerLabel ?? null) : 0;
    const resp = await merchantAgentRound({ ...terms, repeatDeals });
    // The relationship layer records the interaction — without this the
    // seller's feed/leads/customers stay dark on the in-process path.
    if (sellerUserId) {
      await recordSellerInteraction({
        sellerUserId,
        productId: round.productId,
        productTitle: round.productTitle,
        buyerLabel,
        kind: resp.action,
        offerCents: round.offerCents,
        counterCents: resp.action === "counter" || resp.action === "accept" ? resp.priceCents : null,
        message: resp.message,
        listCents: terms.listPriceCents,
      });
    }
    return resp;
  };
  if (!env.mcpSecret) return inProcess();
  try {
    return await callMerchantOverMcp({ ...round, merchantId, buyerLabel, buyerEmail });
  } catch {
    return inProcess();
  }
}

/** Which Parley user owns this catalog product — null for external vendors. */
async function sellerUserFor(productId: string) {
  if (!productId.startsWith("sp_")) return null;
  const [sp] = await getDb()
    .select({ userId: sellerProducts.userId })
    .from(sellerProducts)
    .where(eq(sellerProducts.id, productId))
    .limit(1);
  return sp?.userId ?? null;
}

/** In-process twin of the MCP route's price resolution: the merchant owns its
 * catalog price + active campaign, never the caller's claimed list price. */
async function sellerTerms(
  round: Parameters<typeof merchantAgentRound>[0],
): Promise<Parameters<typeof merchantAgentRound>[0]> {
  if (!round.productId.startsWith("sp_")) return round;
  const db = getDb();
  const [owned] = await db
    .select()
    .from(sellerProducts)
    .where(eq(sellerProducts.id, round.productId))
    .limit(1);
  if (!owned) return round;
  const campaign = await activeCampaignFor(owned.userId, round.productId);
  return {
    ...round,
    listPriceCents: owned.priceCents,
    stockUnits: owned.stock,
    promoCents: campaign
      ? promoPriceCents(owned.priceCents, campaign.pctOff)
      : undefined,
  };
}

/** JSON-RPC call to the merchant agent service — the literal A2A boundary. */
async function callMerchantOverMcp(args: {
  listPriceCents: number;
  offerCents: number;
  roundsUsed: number;
  productId: string;
  productTitle: string;
  merchantId?: string;
  buyerLabel?: string;
  buyerEmail?: string;
}) {
  const res = await fetch(`${env.appUrl}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.mcpSecret}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: "merchant_quote", arguments: args },
    }),
  });
  const json = (await res.json()) as {
    result?: { action: "accept" | "counter" | "walk"; priceCents: number; message: string };
    error?: { message: string };
  };
  if (!res.ok || !json.result) throw new Error(json.error?.message ?? `MCP ${res.status}`);
  return json.result;
}

function approveUrlFor(orderId: string) {
  const host =
    env.paypalEnv === "live" ? "www.paypal.com" : "www.sandbox.paypal.com";
  return `https://${host}/checkoutnow?token=${orderId}`;
}
