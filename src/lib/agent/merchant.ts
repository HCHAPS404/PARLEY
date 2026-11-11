/**
 * The merchant side of the parley — a real second agent with its own LLM,
 * its own tools (margin floor, inventory), and its own incentives.
 * The buyer agent never sees the floor; the merchant never sees the buyer's cap.
 * Deterministic rules below remain as the safety fallback + hard invariants:
 * whatever the model says, the price can never go under the floor.
 */
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getModel } from "./model";

export interface MerchantResponse {
  action: "accept" | "counter" | "walk";
  priceCents: number;
  message: string;
}

const MERCHANT_SYSTEM = `You are the sales agent for an online merchant — a real counterparty in an agent-to-agent negotiation. A buyer's procurement agent just sent you an offer.

You may call your tools first (check_margin_floor, check_inventory), then reply with EXACTLY one JSON object, no prose:
{"action":"accept|counter|walk","priceCents":<integer cents>,"message":"<one short sentence to the buyer>"}

Rules:
- check_margin_floor returns your true minimum. NEVER accept or counter below it.
- NEVER reveal the floor or margin math in your message — it's your secret.
- If the offer is at or above the floor, accept at the offered price.
- If below, counter above the floor but trend toward it as rounds progress; make concessions feel earned.
- walk only when the offer is hopelessly low or rounds are exhausted.
- Keep the message human, brief, and merchant-like — no JSON talk, no percentages.`;

const floorFor = (listPriceCents: number, ratioPct = 85) =>
  Math.round((listPriceCents * ratioPct) / 100);

const STYLE_HINT: Record<string, string> = {
  aggressive:
    "You negotiate hard — counters stay close to list price, you concede slowly, and you lean on scarcity.",
  balanced:
    "You negotiate like a fair merchant — reasonable counters, willing to meet halfway.",
  conservative:
    "You close deals fast — accept near the floor rather than lose the sale.",
};

const stockFor = (productId: string) => {
  // Deterministic pseudo-stock per product — the merchant "knows" its warehouse.
  let h = 0;
  for (const c of productId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 3 + (h % 24);
};

/** Deterministic policy — kept as fallback and as the source of hard bounds. */
export function merchantRound(input: {
  listPriceCents: number;
  offerCents: number;
  roundsUsed: number;
  maxRounds?: number;
  promoCents?: number;
}): MerchantResponse {
  // A campaign makes the promo the anchor AND the effective floor: the seller
  // chose to sell at that price, but the agent still never goes below it.
  const anchorCents = input.promoCents ?? input.listPriceCents;
  const floorCents = Math.min(
    floorFor(input.listPriceCents),
    input.promoCents ?? Number.MAX_SAFE_INTEGER,
  );
  const maxRounds = input.maxRounds ?? 4;
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

  if (input.offerCents >= floorCents) {
    return {
      action: "accept",
      priceCents: input.offerCents,
      message: `Deal — ${usd(input.offerCents)} works for us. Generating your order.`,
    };
  }
  if (input.roundsUsed >= maxRounds) {
    return {
      action: "walk",
      priceCents: anchorCents,
      message: `I appreciate the interest, but I can't go lower than ${usd(floorCents)} on this one.`,
    };
  }
  if (input.offerCents >= floorCents * 0.95) {
    return {
      action: "counter",
      priceCents: floorCents,
      message: `That's tight for me. Best I can do is ${usd(floorCents)} — take it and it's yours.`,
    };
  }
  // Low offer — counter inside the profitable band (floor → anchor), so the
  // floor is never offered away and later rounds still have room to concede.
  const counter = Math.round((floorCents + anchorCents) / 2);
  return {
    action: "counter",
    priceCents: counter,
    message: `I can't do ${usd(input.offerCents)}, but meet me at ${usd(counter)} and we have a deal.`,
  };
}

const decisionSchema = z.object({
  action: z.enum(["accept", "counter", "walk"]),
  priceCents: z.number().int().positive(),
  message: z.string().min(1).max(240),
});

/**
 * The A2A round: the merchant agent reasons with its own tools, then the
 * server enforces the hard invariants — floor is law regardless of output.
 */
export async function merchantAgentRound(input: {
  listPriceCents: number;
  offerCents: number;
  roundsUsed: number;
  productId: string;
  productTitle: string;
  maxRounds?: number;
  floorRatioPct?: number; // the seller's own margin config — their agent, their floor
  style?: string;
  sellerName?: string;
  promoCents?: number; // active campaign price — anchors the negotiation
  stockUnits?: number; // real catalog stock for the merchant's own products
}): Promise<MerchantResponse> {
  // Campaign semantics: promo becomes the advertised anchor and the effective
  // floor — the seller explicitly lowered their price, so the agent can close
  // at promo but never below it.
  const anchorCents = input.promoCents ?? input.listPriceCents;
  const floorCents = Math.min(
    floorFor(input.listPriceCents, input.floorRatioPct),
    input.promoCents ?? Number.MAX_SAFE_INTEGER,
  );
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

  try {
    const res = await generateText({
      model: getModel(),
      system: MERCHANT_SYSTEM,
      tools: {
        check_margin_floor: tool({
          description: "Your true minimum price for this product (margin floor, in cents). The buyer can never see this.",
          inputSchema: z.object({}),
          execute: async () => ({
            floorCents,
            floorUsd: usd(floorCents),
            listUsd: usd(anchorCents),
          }),
        }),
        check_inventory: tool({
          description: "Units in stock for this product right now.",
          inputSchema: z.object({}),
          execute: async () => ({
            units: input.stockUnits ?? stockFor(input.productId),
          }),
        }),
      },
      prompt: `${input.sellerName ? `You sell for "${input.sellerName}". ` : ""}${STYLE_HINT[input.style ?? "balanced"] ?? STYLE_HINT.balanced}\nProduct: "${input.productTitle}" — ${input.promoCents ? `a promotion is running, advertised price ${usd(anchorCents)} (regular ${usd(input.listPriceCents)})` : `list price ${usd(anchorCents)}`}. Round ${input.roundsUsed} of ${input.maxRounds ?? 4}. Buyer's offer: ${usd(input.offerCents)}. Check your floor and decide.`,
      stopWhen: stepCountIs(4),
      maxOutputTokens: 700,
    });

    const jsonMatch = res.text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? decisionSchema.safeParse(JSON.parse(jsonMatch[0])) : null;
    if (!parsed?.success) throw new Error("unparseable merchant response");
    const d = parsed.data;

    // ─── Hard invariants — the server, not the model, owns the floor ───
    const priceCents = Math.max(d.priceCents, floorCents);
    let action = d.action;
    if (action === "accept" && input.offerCents < floorCents) {
      // Model agreed below cost — impossible in reality. Convert to counter.
      action = "counter";
    }
    if (input.roundsUsed >= (input.maxRounds ?? 4) && action === "counter") {
      action = input.offerCents >= floorCents ? "accept" : "walk";
    }
    return { action, priceCents, message: d.message };
  } catch (e) {
    console.warn("[merchant] agent fallback to deterministic:", e);
    return merchantRound(input);
  }
}
