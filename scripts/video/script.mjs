/**
 * Parley — 2-minute elevator-pitch film. Single source of truth.
 *
 * A film is a list of SECTIONS. Each section has one voice-over line and one
 * or more SEGMENTS (an animated slide or a recorded take). A section lasts at
 * least as long as its VO plus breathing room; segments split that time by
 * `share`. Transitions between segments are declared on the *incoming* one.
 */
export const VOICE = { name: "en-US-AndrewMultilingualNeural", rate: "+4%", pitch: "-2Hz" };

export const FILM = [
  {
    id: "hook",
    vo: "Every small business overpays for supplies. There's no time to compare vendors, and no leverage to negotiate.",
    segments: [{ slide: "hook" }],
  },
  {
    id: "intro",
    vo: "Meet Parley: an AI procurement agent that finds real products, negotiates the price with the seller's own agent, and pays through PayPal escrow.",
    segments: [{ slide: "intro", in: "fade" }],
  },
  {
    id: "ask",
    vo: "You just ask. The buyer agent searches live catalogs, then opens a negotiation with each merchant's agent: two AIs, haggling in real time. Seconds later you get negotiated prices, the real savings, and a recommendation that fits your business.",
    segments: [{ take: "buyerAsk", in: "slideleft" }],
  },
  {
    id: "trust",
    vo: "And the model never sets the price. Prices are resolved on the server, the seller's floor is enforced in code, and every order has to pass your own spend policy.",
    segments: [{ slide: "trust", in: "slideleft" }],
  },
  {
    id: "order",
    vo: "Pick a deal, and Parley prepares a PayPal order with intent authorize. You approve it on PayPal yourself. The agent never touches your credentials.",
    segments: [{ take: "buyerOrder", in: "slideleft" }],
  },
  {
    id: "escrow",
    vo: "That's agentic escrow. The money is authorized, not captured. It only moves to the seller once delivery is confirmed, and if something goes wrong, the hold is simply voided.",
    segments: [{ slide: "escrow", in: "slideleft" }],
  },
  {
    id: "pipeline",
    vo: "Every order lives in a pipeline, organized by space. Tracking flows in automatically, and each release produces a Parley receipt, ready to print or save as a PDF.",
    segments: [
      { take: "pipeline", in: "slideleft", share: 0.62 },
      { take: "receipt", in: "fade", share: 0.38 },
    ],
  },
  {
    id: "insight",
    vo: "Analytics shows what you spent, what negotiating saved you, and how reliable each vendor really is. Anything that needs a human, like offers, reorders or deliveries, lands in Approvals.",
    segments: [
      { take: "analytics", in: "fade", share: 0.6 },
      { take: "approvals", in: "fade", share: 0.4 },
    ],
  },
  {
    id: "sellerSlide",
    vo: "And sellers get an agent too.",
    segments: [{ slide: "seller", in: "slideleft" }],
  },
  {
    id: "sellerHome",
    vo: "Every negotiation feeds the seller's dashboard: revenue, close rate, the whole funnel. Their AI assistant reads those numbers, and can act on them.",
    segments: [
      { take: "sellerHome", in: "slideleft", share: 0.5 },
      { take: "sellerCopilot", in: "fade", share: 0.5 },
    ],
  },
  {
    id: "relationship",
    vo: "Sellers dress their catalog in a few clicks, and every deal becomes a relationship: a direct thread with pinned terms, and photos of what actually arrived.",
    segments: [
      { take: "inventory", in: "fade", share: 0.5 },
      { take: "sellerThread", in: "fade", share: 0.5 },
    ],
  },
  {
    id: "storefront",
    vo: "Trust is public. Every store shows live promo pricing, a vendor score, and reviews tied to real escrowed orders.",
    segments: [{ take: "storefront", in: "fade" }],
  },
  {
    id: "close",
    vo: "Parley. Your agent negotiates, PayPal protects the money, and you stay in control.",
    segments: [{ slide: "close", in: "slideleft" }],
    tail: 3.2,
  },
];

export const TIMING = {
  lead: 0.55, // VO starts this long after the section's first segment begins
  pad: 1.15, // breathing room after the VO before the next transition
  xfade: { slideleft: 0.7, fade: 0.5 },
};
