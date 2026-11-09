import { NextResponse } from "next/server";
import { merchantAgentRound } from "@/lib/agent/merchant";
import { env } from "@/lib/env";

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
      const resp = await merchantAgentRound({
        productId: String(args?.productId ?? ""),
        productTitle: String(args?.productTitle ?? "Product"),
        listPriceCents,
        offerCents,
        roundsUsed,
      });
      return rpc(body.id, resp);
    }
    return rpc(body.id, undefined, { code: -32601, message: `Unknown tool: ${name}` });
  }

  return rpc(body.id, undefined, { code: -32601, message: `Method not found: ${body.method}` });
}
