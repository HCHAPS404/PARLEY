# Parley

**Procurement that negotiates.**

Parley is an agentic procurement platform for solopreneurs and micro-businesses — the procurement department they can't afford. An AI buyer agent searches real products, negotiates price with merchant-side agents (A2A), and pays through **agentic escrow on PayPal**: funds are authorized when you approve, and only captured when delivery is confirmed.

Built for the **PayPal AI Hackathon**.

**Live demo:** https://parley-wt1k.onrender.com

---

## The problem

An Etsy seller, a freelancer, a corner café — they all buy supplies, but none of them have a procurement team. They overpay because they can't compare and negotiate at scale, and they eat the risk when a vendor doesn't deliver: card charges are instant, disputes are slow, and "buyer protection" is a claim process, not a control.

Parley inverts that. An agent does the comparing and negotiating. PayPal does the settling. And the money doesn't move until the goods arrive.

## How it works

```
You:        "Find me a USB-C cable under $10"
            │
Agent:      search_products ──────► Channel3 catalog (real merchants, real prices)
            │
Agent:      merchant_quote ───────► Merchant agent negotiates (up to 4 rounds)
            │                        "List $16.99 → counter $10.72"
            │
You:        approve the summarized purchase
            │
Agent:      create_escrow_order ──► policy check ──► PayPal order (intent: AUTHORIZE)
            │                        deterministic caps — the model can't override them
            │
You:        approve on PayPal ────► authorization hold placed (escrow begins)
            │
Delivery:   confirm_delivery_release ──► capture ──► funds released to seller
            │
No-show:    void authorization ──► funds released back to you
```

The escrow lifecycle is the product: **authorize → hold → capture on delivery, or void on failure.** Parley tracks every transition locally, scores vendors on delivery performance, and logs every agent decision to an append-only audit trail with token cost.

## Why it's not a chatbot with a checkout button

- **Prices never come from the model.** `create_escrow_order` resolves the amount server-side from the product cache or an accepted negotiation quote. The LLM selects a product ID — it cannot invent a number that reaches PayPal.
- **Deterministic policy gates every order.** Per-transaction, daily, and monthly caps live in `policies` and are evaluated in code (`src/lib/policy.ts`), not in the prompt. The agent can propose; it cannot spend.
- **Human approves every payment.** The PayPal approval link/button is the last mile — the agent never touches credentials.
- **Capture only after delivery.** `AUTHORIZE` intent, not `CAPTURE`. Releasing funds is a separate, explicit step.
- **Everything is audited.** Actor, action, rationale, token count, and cost — append-only, queryable, and rendered in the analytics workspace.

## Agent tools

| Tool | What it does |
|---|---|
| `search_products` | Live product search via Channel3 — title, price, merchant, URL. Results are cached server-side; later tools can only reference these IDs. |
| `merchant_quote` | Agent-to-agent negotiation with a merchant-side agent. Up to 4 rounds per negotiation; an accepted quote becomes the order price. |
| `create_escrow_order` | Resolves unit price server-side → runs `checkPolicy` → creates PayPal `AUTHORIZE` order → records local order + audit → returns approval URL. |
| `get_escrow_status` | Reads live PayPal status of an order. |
| `confirm_delivery_release` | Captures the authorization after delivery confirmation — the release valve of the escrow. |
| `list_orders` | Local order mirror (PayPal IDs, status, amounts). |
| PayPal Agent Toolkit | Invoices, disputes, transaction lookup, shipment tracking, payment insights — normalized to AI SDK v7. |

## Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 |
| Agent | Vercel AI SDK v7 (`streamText`, tools, `useChat`) |
| LLM | Pluggable providers — **Modal** (GLM-5.3-Flash dedicated endpoint) · **Meta Model API** (muse-spark-1.3) · **Gemini** (fallback). Switch with `LLM_PROVIDER`. |
| Payments | PayPal Orders v2 (AUTHORIZE/authorize/capture/void) + PayPal Agent Toolkit + JS SDK buttons |
| Catalog | Channel3 product search API |
| Database | Neon Postgres (production) · embedded PGlite (local dev) — same Drizzle schema, zero config swap |
| Analytics | AG Grid Enterprise + AG Studio report builder (`/analytics`) |
| Timeline | Bryntum Gantt — order escrow lifecycle as a project plan (`/pipeline`) |
| Hosting | Render (Blueprint `render.yaml`) · health check `/api/health` |

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Buyer agent chat UI
│   ├── analytics/                # AG Studio workspace (orders, agent activity, vendors, alerts)
│   ├── pipeline/                 # Bryntum Gantt — escrow lifecycle per order
│   └── api/
│       ├── chat/                 # Agent loop: streamText + tools + provider switch
│       ├── health/               # Liveness + integration status
│       ├── paypal/return|cancel/ # PayPal checkout return handlers
│       ├── analytics-data/       # Feeds AG Studio data sources
│       └── pipeline-data/        # Feeds the Gantt
├── lib/
│   ├── agent/
│   │   ├── system.ts             # Buyer agent system prompt + guardrails
│   │   ├── merchant.ts           # Merchant-side agent persona (A2A counterparty)
│   │   └── tools.ts              # search / negotiate / escrow / release / list
│   ├── paypal.ts                 # Orders v2 REST client — the only escrow write path
│   ├── paypal-toolkit.ts         # Agent Toolkit tools (invoices, disputes, txns, insights)
│   ├── channel3.ts               # Product search, normalized to ProductCard
│   ├── policy.ts                 # Deterministic spend gate — tx/day/month caps
│   ├── audit.ts                  # Append-only action + token-cost log
│   ├── env.ts                    # Centralized server-side env access
│   └── db/
│       ├── schema.ts             # policies · orders_local · audit_log · vendor_scores · alerts
│       └── index.ts              # Drizzle: Neon (DATABASE_URL) or PGlite fallback
├── render.yaml                   # Render Blueprint — web service + env contract
└── neon.ts                       # Neon project wiring
```

## Security model

These are invariants, not features — the code enforces them:

1. **Money amounts are never model output.** Server-side price resolution only.
2. **`checkPolicy` cannot be bypassed** — it runs before every PayPal call, and tool retries can't route around it.
3. **No `CAPTURE` before delivery confirmation.** Authorization and capture are separate API calls with separate gates.
4. **Idempotent writes** — every mutating PayPal call sends a fresh `PayPal-Request-Id`.
5. **Secrets stay server-side.** Only `NEXT_PUBLIC_*` variables reach the browser; the PayPal secret never does.
6. **Tool results are data.** The system prompt instructs the model to treat tool output as untrusted content, never as instructions.
7. **Audit never lies.** `audit()` wraps every consequential action; it fails safe (catches internally) so a logging problem can never block or corrupt a payment path.

## Database

Five tables, same schema on Neon and PGlite — `ensureDb()` bootstraps DDL + seeds the default policy on first run:

| Table | Purpose |
|---|---|
| `policies` | Per-tx / daily / monthly spend caps, autonomous limit, vendor allowlists |
| `orders_local` | Local mirror of PayPal order state (IDs, amounts, escrow stage) |
| `audit_log` | Append-only agent/system actions with rationale, tokens, cost |
| `vendor_scores` | Merchant reputation — delivery rate, disputes, response metrics |
| `alerts` | Watchdog findings — price hikes, duplicate charges, overdue delivery |

**Default policy:** $250/tx · $750/day · $3,000/month · $50 autonomous limit.

## Quickstart

```bash
git clone https://github.com/HCHAPS404/PARLEY.git
cd parley
npm ci
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

First run bootstraps the local PGlite database automatically — no migrations needed.

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | ✅ | developer.paypal.com → Apps & Credentials → **Sandbox** app |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | ✅ | Same client ID — exposed to the browser for PayPal JS SDK |
| `PAYPAL_ENV` | ✅ | `sandbox` for the hackathon |
| `CHANNEL3_API_KEY` | ✅ | Product catalog search |
| `LLM_PROVIDER` | ✅ | `modal` \| `meta` \| `google` |
| `MODAL_API_KEY` / `MODAL_BASE_URL` / `MODAL_MODEL` | one LLM | Modal Shared Endpoint proxy token (`wk-…​.ws-…​`) |
| `META_API_KEY` / `META_BASE_URL` / `META_MODEL` | one LLM | Meta Model API key (`LLM_…​`), model `muse-spark-1.3` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | one LLM | Gemini fallback |
| `DATABASE_URL` | prod only | Neon Postgres — empty = embedded PGlite locally |
| `CRON_SECRET` | prod only | Guards `/api/jobs/*` |
| `NEXT_PUBLIC_APP_URL` | prod only | e.g. `https://parley-wt1k.onrender.com` — PayPal return URLs |
| `NEXT_PUBLIC_AG_GRID_LICENSE` | optional | AG Grid Enterprise / AG Studio license |
| `NEXT_PUBLIC_BRYNTUM_LICENSE` | optional | Bryntum Gantt license |

## Testing the escrow flow (sandbox)

1. Talk to the agent: *"find me a USB microphone under $80"*
2. Pick a product — the agent summarizes the purchase with the **server-verified** price
3. Confirm → the agent returns a PayPal approval link
4. Open it, log in with your **sandbox Personal** account, approve
5. Back in chat: *"confirm delivery"* → authorization is captured

Or drive the lifecycle directly — order `AUTHORIZE` → approve → `authorize` → `capture`/`void` — through the same `src/lib/paypal.ts` the agent uses.

## Deploy

`render.yaml` is a complete Blueprint — Render builds from `npm ci && npm run build`, serves `npm run start`, health-checks `/api/health`, and declares every env var (`sync: false` secrets are entered once in the dashboard, never in git). Point it at a Neon `DATABASE_URL` and the same schema bootstraps itself in production.

```json
// GET /api/health on production
{"ok":true,"db":"postgres","configured":{"paypal":true,"llm":true,"channel3":true}}
```

## Business model (the "why this is a product" slide)

- **Free** — agent search + compare, manual checkout
- **Pro ~$19/mo** — autonomous negotiation, escrow orders, vendor scoring
- **Business ~$59/mo** — higher caps, multi-user policies, analytics workspace
- **Protection fee ~1%/tx** on escrow releases — cheaper than a chargeback
- **Affiliate revenue** via Channel3 merchant referrals

## Roadmap

- [x] Agent loop with real catalog + A2A negotiation
- [x] Agentic escrow on PayPal (authorize → capture on delivery)
- [x] Deterministic spend policy + audit trail
- [x] Production deploy (Render + Neon)
- [ ] Durable session/product cache (currently per-process)
- [ ] Escrow watchdog cron — auto-flag overdue deliveries via `/api/jobs/*`
- [ ] Vendor scoring wired into merchant selection
- [ ] Neon Realtime live dashboard updates
- [ ] Webhook-driven order status sync (currently polled)

## License

MIT — see [LICENSE](LICENSE).
