/**
 * The merchant side of the parley — a second agent persona with its own
 * incentives (protect margin) and hard limits (floor price). Deterministic
 * today; moves behind a real MCP endpoint (/api/mcp) for the A2A demo.
 */

export interface MerchantResponse {
  action: "accept" | "counter" | "walk";
  priceCents: number;
  message: string;
}

export function merchantRound(input: {
  listPriceCents: number;
  offerCents: number;
  roundsUsed: number;
  maxRounds?: number;
}): MerchantResponse {
  const floorCents = Math.round(input.listPriceCents * 0.85);
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
      priceCents: input.listPriceCents,
      message: `I appreciate the interest, but I can't go lower than ${usd(floorCents)} on this one.`,
    };
  }
  if (input.offerCents >= floorCents * 0.95) {
    // Close to the floor: reveal best-and-final instead of midpoint.
    return {
      action: "counter",
      priceCents: floorCents,
      message: `That's tight for me. Best I can do is ${usd(floorCents)} — take it and it's yours.`,
    };
  }
  const counter = Math.round((input.offerCents + floorCents) / 2);
  return {
    action: "counter",
    priceCents: counter,
    message: `I can't do ${usd(input.offerCents)}, but meet me at ${usd(counter)} and we have a deal.`,
  };
}
