/**
 * Parley demo video — scene manifest.
 * Single source of truth for VO, takes, title cards and assembly.
 * Times are target durations (s); the director doc explains intent per scene.
 */
export const SCENES = [
  {
    id: "00-cold-open",
    kind: "title",
    dur: 5,
    headline: "Your agent just saved you $5.00.",
    subline: "While you slept.",
    vo: null,
  },
  {
    id: "01-the-ask",
    kind: "take",
    dur: 12,
    who: "buyer",
    vo: "Meet Parley — an AI buyer that finds real products, then negotiates for them.",
    route: "/app",
    steps: [
      { act: "type", sel: "textarea", text: "I need shipping supplies for my bakery launch", rate: 55 },
      { act: "press", key: "Enter" },
      { act: "pause", ms: 5500 },
      { act: "scrollBottom", sel: "main" },
      { act: "pause", ms: 2500 },
    ],
  },
  {
    id: "02-negotiation",
    kind: "take",
    dur: 14,
    who: "buyer",
    vo: "Two agents talk to each other. The seller's agent defends its floor — yours pushes back. Every cent is settled server-side, never from a prompt.",
    route: "/app",
    steps: [
      { act: "pause", ms: 1500 },
      { act: "zoomTo", sel: "[data-negotiation], .negotiation, main article:last-of-type", factor: 1.35 },
      { act: "pause", ms: 6000 },
      { act: "zoomOut" },
      { act: "pause", ms: 3000 },
    ],
  },
  {
    id: "03-escrow",
    kind: "take",
    dur: 12,
    who: "buyer",
    vo: "Payment goes into PayPal escrow — authorized, not captured. The money sits protected until the box arrives.",
    route: "/pipeline",
    steps: [
      { act: "pause", ms: 1500 },
      { act: "zoomTo", sel: "text=/authorized/i >> nth=0", factor: 1.3 },
      { act: "pause", ms: 4500 },
      { act: "glideTo", sel: "button:has-text('Approve'), a:has-text('Approve')" },
      { act: "zoomOut" },
      { act: "pause", ms: 2500 },
    ],
  },
  {
    id: "04-delivery-receipt",
    kind: "take",
    dur: 13,
    who: "buyer",
    vo: "Track the shipment in-line. When it lands, confirm delivery — the escrow releases, and Parley writes the receipt for you.",
    route: "/pipeline",
    steps: [
      { act: "click", sel: "button:has-text('Kraft mailer'), [class*='order']:has-text('Kraft')" },
      { act: "pause", ms: 2500 },
      { act: "scrollInto", sel: "text=/tracking|UPS/i" },
      { act: "pause", ms: 3500 },
      { act: "click", sel: "a:has-text('Receipt'), a:has-text('receipt')" },
      { act: "pause", ms: 3500 },
    ],
  },
  {
    id: "05-seller-side",
    kind: "take",
    dur: 14,
    who: "seller",
    vo: "On the other side, a merchant agent closes deals while the seller sleeps — campaigns, price floors, and a live feed of every counter-offer.",
    route: "/",
    steps: [
      { act: "pause", ms: 2000 },
      { act: "scrollTo", y: 400 },
      { act: "pause", ms: 4000 },
      { act: "scrollTo", y: 900 },
      { act: "zoomTo", sel: "text=/counter|walked|closed/i >> nth=0", factor: 1.3 },
      { act: "pause", ms: 4000 },
      { act: "zoomOut" },
    ],
  },
  {
    id: "06-relationships",
    kind: "take",
    dur: 11,
    who: "buyer",
    vo: "Deals become relationships — direct threads, pinned bulk pricing, photos of what actually arrived.",
    route: "/messages",
    steps: [
      { act: "click", sel: "li button, [role='listitem'] button" },
      { act: "pause", ms: 2500 },
      { act: "zoomTo", sel: "text=/Standing bulk|pinned/i >> nth=0", factor: 1.35 },
      { act: "pause", ms: 4500 },
      { act: "zoomOut" },
    ],
  },
  {
    id: "07-trust",
    kind: "take",
    dur: 9,
    who: "public",
    vo: "Public storefronts. Vendor scores. Reviews on real, escrowed orders.",
    route: "/s/parcelpro-supply",
    steps: [
      { act: "pause", ms: 2000 },
      { act: "scrollTo", y: 500 },
      { act: "pause", ms: 4000 },
    ],
  },
  {
    id: "08-end-card",
    kind: "title",
    dur: 8,
    headline: "Parley",
    subline: "procurement that negotiates — parley-wt1k.onrender.com",
    vo: "Parley. Procurement that negotiates.",
  },
];

export const VOICE = "en-US-AndrewNeural"; // confident male; alternatives: en-US-BrianNeural, en-US-ChristopherNeural
export const VOICE_RATE = "+2%"; // slightly brisk demo pace
