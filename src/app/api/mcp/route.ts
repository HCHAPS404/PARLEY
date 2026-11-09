import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { merchantAgentRound } from "@/lib/agent/merchant";
import { paypalTools } from "@/lib/paypal-toolkit";
import { env } from "@/lib/env";
import { ensureDb, getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { alerts, merchantProfiles, merchantSales, spaces } from "@/lib/db/schema";

export const maxDuration = 60;

/**
 * MCP-style JSON-RPC boundary — the merchant agent is a *service*, not a
 * function call inside the buyer's process. Any agent that can speak JSON-RPC
 * can negotiate with it; the buyer agent calls this endpoint over HTTP so the
 * A2A boundary is literal.
 */
const TOOLS = [
  {
    name: "merchant_quote",
    description:
      "One round of price negotiation with the merchant agent for a product.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        productTitle: { type: "string" },
        listPriceCents: { type: "integer" },
        offerCents: { type: "integer" },
        roundsUsed: { type: "integer" },
        merchantId: { type: "string", description: "A Parley user's merchant profile — negotiate with THEIR agent" },
        buyerLabel: { type: "string" },
      },
      required: ["productId", "productTitle", "listPriceCents", "offerCents", "roundsUsed"],
    },
  },
  {
    name: "check_inventory",
    description: "Units in stock for a product.",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "string" } },
      required: ["productId"],
    },
  },
];

function rpc(id: unknown, result?: unknown, error?: { code: number; message: string }) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, ...(error ? { error } : { result }) });
}

export async function POST(req: Request) {
  if (!env.mcpSecret)
    return NextResponse.json({ error: "MCP_SECRET not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${env.mcpSecret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`mcp:${ip}`, 120, 3600_000).ok)
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  try {
    body = await req.json();
  } catch {
    return rpc(null, undefined, { code: -32700, message: "Parse error" });
  }
  if (body.jsonrpc !== "2.0" || !body.method)
    return rpc(body.id, undefined, { code: -32600, message: "Invalid Request" });

  if (body.method === "tools/list") return rpc(body.id, { tools: TOOLS });

  if (body.method === "tools/call") {
    const { name, arguments: args } = body.params ?? {};
    if (name === "check_inventory") {
      const productId = String(args?.productId ?? "");
      let h = 0;
      for (const c of productId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return rpc(body.id, { units: 3 + (h % 24) });
    }
    if (name === "merchant_quote") {
      const listPriceCents = Number(args?.listPriceCents);
      const offerCents = Number(args?.offerCents);
      const roundsUsed = Number(args?.roundsUsed ?? 1);
      if (!Number.isInteger(listPriceCents) || !Number.isInteger(offerCents) || listPriceCents <= 0 || offerCents <= 0)
        return rpc(body.id, undefined, { code: -32602, message: "Invalid price params" });

      // merchant_id → this sale is negotiated by a real Parley user's own
      // merchant agent, under their floor and their style. Absent → shared
      // demo merchant at the default 85% floor.
      const merchantId = args?.merchantId ? String(args.merchantId) : null;
      let profile: typeof merchantProfiles.$inferSelect | null = null;
      if (merchantId) {
        await ensureDb();
        const [p] = await getDb()
          .select()
          .from(merchantProfiles)
          .where(eq(merchantProfiles.id, merchantId))
          .limit(1);
        profile = p ?? null;
      }
      const resp = await merchantAgentRound({
        productId: String(args?.productId ?? ""),
        productTitle: String(args?.productTitle ?? "Product"),
        listPriceCents,
        offerCents,
        roundsUsed,
        floorRatioPct: profile?.floorRatioPct,
        style: profile?.style,
        sellerName: profile?.displayName,
      });
      // A closed deal is the seller's revenue — record it on their ledger.
      if (resp.action === "accept" && profile) {
        const db = getDb();
        const saleId = crypto.randomUUID();
        await db.insert(merchantSales).values({
          id: saleId,
          sellerUserId: profile.userId,
          productTitle: String(args?.productTitle ?? "Product"),
          agreedCents: resp.priceCents,
          buyerLabel: args?.buyerLabel ? String(args.buyerLabel) : null,
        });
        // Route the sale alert into the seller's own space so their inbox sees it.
        const [sellerSpace] = await db
          .select({ id: spaces.id })
          .from(spaces)
          .where(eq(spaces.userId, profile.userId))
          .limit(1);
        // Auto-invoice the buyer when they shared a billing email — the
        // seller's agent closes AND bills without human clicks.
        let invoiced = false;
        const buyerEmail = args?.buyerEmail ? String(args.buyerEmail) : null;
        if (buyerEmail) {
          try {
            const tools = paypalTools() as Record<string, { execute?: (a: unknown) => Promise<unknown> }>;
            const value = (resp.priceCents / 100).toFixed(2);
            const created = (await tools["create_invoice"]?.execute?.({
              detail: { currency_code: "USD", note: `Parley A2A sale — ${profile.displayName}`, payment_term: { term_type: "DUE_ON_RECEIPT" } },
              primary_recipients: [{ billing_info: { email_address: buyerEmail } }],
              items: [{ name: String(args?.productTitle ?? "Item").slice(0, 127), quantity: "1", unit_amount: { currency_code: "USD", value } }],
              amount: { breakdown: { item_total: { currency_code: "USD", value } } },
            })) as { id?: string } | undefined;
            if (created?.id) {
              await tools["send_invoice"]?.execute?.({ invoice_id: created.id });
              await db.update(merchantSales).set({ status: "invoiced" }).where(eq(merchantSales.id, saleId));
              invoiced = true;
            }
          } catch { /* invoicing is best-effort — the sale stands */ }
        }
        await db.insert(alerts).values({
          kind: "sale_closed",
          spaceId: sellerSpace?.id ?? null,
          payload: {
            saleId,
            title: `Your agent sold "${String(args?.productTitle ?? "item").slice(0, 80)}"`,
            priceUsd: resp.priceCents / 100,
            reason: `Closed by ${profile.displayName} at $${(resp.priceCents / 100).toFixed(2)}${invoiced ? " — invoice sent to the buyer" : " — issue the invoice to get paid"}`,
          },
        });
      }
      return rpc(body.id, resp);
    }
    return rpc(body.id, undefined, { code: -32601, message: `Unknown tool: ${name}` });
  }

  return rpc(body.id, undefined, { code: -32601, message: `Method not found: ${body.method}` });
}
