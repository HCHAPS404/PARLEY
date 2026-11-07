import { tool } from "ai";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { searchProducts, type ProductCard } from "../channel3";
import {
  createEscrowOrder,
  getOrder,
  captureAuthorization,
} from "../paypal";
import { paypalTools } from "../paypal-toolkit";
import { checkPolicy } from "../policy";
import { audit } from "../audit";
import { getDb, ensureDb } from "../db";
import { ordersLocal, vendorScores } from "../db/schema";
import { merchantRound } from "./merchant";
import { env } from "../env";

// ─── Server-side resolution caches ──────────────────────────────────
// Prices never come from the model. They are resolved here from data the
// tools previously fetched — the agent can only *select*, never *invent*.
const productCache = new Map<string, ProductCard>();
const negotiations = new Map<
  string,
  {
    productId: string;
    listPriceCents: number;
    agreedCents: number | null;
    status: "open" | "agreed" | "walked";
    transcript: { speaker: "buyer" | "merchant"; text: string }[];
  }
>();

const usd = (cents: number) => cents / 100;
const toCents = (dollars: number) => Math.round(dollars * 100);

export function agentTools() {
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
        const { products, error } = await searchProducts({
          query,
          imageUrl,
          maxPriceCents: maxPriceUsd ? toCents(maxPriceUsd) : undefined,
          limit,
        });
        for (const p of products) productCache.set(p.id, p);
        await audit({
          actor: "agent",
          action: "search_products",
          input: { query, imageUrl, maxPriceUsd },
          output: { count: products.length, error },
        });
        return { products, count: products.length, ...(error ? { error } : {}) };
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
        const product = productCache.get(productId);
        if (!product || product.bestPriceCents == null) {
          return { error: "Product not in search context — run search_products first" };
        }
        let session = negotiationId ? negotiations.get(negotiationId) : undefined;
        if (!session) {
          session = {
            productId,
            listPriceCents: product.bestPriceCents,
            agreedCents: null,
            status: "open",
            transcript: [],
          };
          negotiationId = crypto.randomUUID();
          negotiations.set(negotiationId, session);
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
        await audit({
          actor: "merchant",
          action: "merchant_quote",
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
        const product = productCache.get(productId);
        if (!product) {
          return { error: "Product not in search context — run search_products first" };
        }
        let unitCents = product.bestPriceCents;
        let negotiated = false;
        if (negotiationId) {
          const n = negotiations.get(negotiationId);
          if (n?.status === "agreed" && n.agreedCents != null) {
            unitCents = n.agreedCents;
            negotiated = true;
          }
        }
        if (unitCents == null) return { error: "No price available for product" };

        const amountCents = unitCents * quantity;
        const decision = await checkPolicy({ amountCents, vendor: product.merchant });
        if (!decision.allow) {
          await audit({
            actor: "system",
            action: "policy_denied",
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
        const approveUrl = order.links?.find(
          (l) => l.rel === "approve" || l.rel === "payer-action",
        )?.href;

        await ensureDb();
        await getDb()
          .insert(ordersLocal)
          .values({
            id: crypto.randomUUID(),
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
        await ensureDb();
        const db = getDb();
        const [row] = await db
          .select()
          .from(ordersLocal)
          .where(eq(ordersLocal.paypalOrderId, paypalOrderId))
          .limit(1);
        if (!row) return { error: "Order not found locally" };

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
        if (row.vendor) {
          await db
            .insert(vendorScores)
            .values({
              domain: row.vendor,
              score: 70,
              ordersCount: 1,
              onTimeCount: 1,
            })
            .onConflictDoUpdate({
              target: vendorScores.domain,
              set: {
                ordersCount: (await import("drizzle-orm")).sql`${vendorScores.ordersCount} + 1` as never,
                updatedAt: new Date(),
              },
            });
        }
        await audit({
          actor: "system",
          action: "escrow_captured",
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

    get_escrow_status: tool({
      description: "Check the live PayPal status of an escrow order.",
      inputSchema: z.object({ paypalOrderId: z.string() }),
      execute: async ({ paypalOrderId }) => {
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
      description: "List recent escrow orders from the local audit store.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
      execute: async ({ limit }) => {
        await ensureDb();
        const rows = await getDb()
          .select()
          .from(ordersLocal)
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

    ...paypalTools(),
  };
}
