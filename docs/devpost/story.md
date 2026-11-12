## Inspiration

An Etsy seller, a freelancer, a corner café — they all buy supplies, but none of them have a procurement department. They overpay because they can't compare and negotiate at scale, and they eat the risk when a vendor doesn't deliver: card charges are instant, disputes are slow, and "buyer protection" is a claim process, not a control.

Enterprises solved this decades ago with procurement teams and escrow terms. A one-person business gets neither. We built Parley to invert that: a *parley* is a conference between two parties — and here it's literal. Your buyer agent negotiates with the seller's agent, and PayPal settles the deal.

## What it does

Parley is an agentic procurement platform where **two AI agents** — yours and the seller's — meet in the same market:

- A **buyer agent** searches real products (Channel3), compares offers across vendors — including other users' stores — and negotiates price through a real agent-to-agent protocol. The counterparty is a second LLM agent with its own prompt, tools, and a margin floor enforced in code — not a template.
- When they close, money moves like serious procurement: a deterministic spend policy gates the order, the human approves on PayPal, and an `AUTHORIZE` hold escrows the funds — **never `CAPTURE` upfront**.
- The seller registers carrier tracking; a watchdog cron polls the shipment until the carrier reports `DELIVERED`. The buyer confirms receipt and releases — only then is the authorization captured. Never arrives? The hold is **voided**. Escrow, not a chargeback.
- And the part no demo does: **the relationship outlives the deal.** A closed order opens a buyer↔seller channel with the escrow timeline as system events. Sellers get a CRM, send win-back offers that mint new escrows, and earn reviews feeding a public vendor score on their no-login storefront.
- Around the edges: multi-vendor RFQs, partial releases, claims that hold the escrow while humans talk, autonomous reorder rules bounded by policy, price watches, and per-space cost-center isolation.

## How we built it

- **App:** Next.js 16 + React 19 + strict TypeScript, Tailwind v4.
- **Buyer agent:** Vercel AI SDK v7 — `streamText` + ~20 tools (`search_products`, `merchant_quote`, `create_escrow_order`, `register_tracking`, `confirm_delivery_release`, `void_escrow_order`, `request_invoice`, `run_rfQ`, reorder rules, price watches…). Pluggable LLM: Modal / Meta Model API / Gemini.
- **Merchant agent:** a second, independent LLM agent with its own tools (`check_margin_floor`, `check_inventory`) served over an MCP/JSON-RPC boundary — real A2A, not a function call.
- **Payments:** PayPal Orders v2 REST client for the escrow write path (`AUTHORIZE` → authorize → capture / void / partial capture) + PayPal Agent Toolkit (invoices, disputes, transaction search, shipment tracking, insights) + JS SDK approval buttons.
- **Trust layer:** deterministic policy engine, server-side price resolution, append-only audit log with per-action token cost — pinned by 37 invariant tests.
- **Data & infra:** Drizzle ORM on Neon Postgres (embedded PGlite locally), 18-table self-bootstrapping schema, watchdog cron on Render reconciling PayPal state, tracking shipments, and running reorders every 15 min.

## Challenges we ran into

- **You can't let the model touch money.** LLMs hallucinate numbers. So the model only selects product IDs — prices resolve server-side from the search cache or an accepted quote, `checkPolicy` runs in code before every PayPal call, and a human approves every payment. The agent proposes; code disposes.
- **"Escrow" isn't a PayPal button — it's discipline.** `AUTHORIZE` intent means authorization and capture are separate API calls with separate gates. Keeping the local ledger, PayPal state, and carrier tracking consistent took the watchdog cron and careful state machines — including the unhappy paths: claims, voids, expired authorizations, partial deliveries.
- **A merchant agent that can't sell below cost.** The counterparty LLM reasons freely, but every decision is clamped server-side against its margin floor — whatever the model outputs, the floor is law.
- **Making "real" verifiable.** Every escrow in the demo is a live PayPal sandbox authorization; `SEED-*` fixtures are labeled as such. Judges can check `/api/health` and replay any negotiation transcript.

## Accomplishments we're proud of

- A genuine agent-to-agent negotiation between two independent LLM agents over a real MCP boundary — the seller counters at exactly its floor.
- The full escrow lifecycle running against PayPal sandbox: authorize → hold → shipment-aware delivery → human-gated capture, or void.
- A two-sided marketplace where buyer and seller agents never talk to each other's human — yet the humans end up doing business.
- 37 invariant tests pinning every money rule and relationship rule.

## What we learned

Agentic commerce is not a chatbot glued to a checkout button. The model can *propose* — only *code* should move money. PayPal's authorize/capture split, treated as escrow rather than payment, is what makes autonomous buying safe enough to trust. And the most valuable thing an agent can close isn't a transaction — it's a supplier relationship.

## What's next for Parley

Neon Realtime for live dashboard updates, hardened webhook signature verification, multi-currency policies, and a real-money pilot with actual micro-businesses.
