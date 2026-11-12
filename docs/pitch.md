# Parley — submission pitch

## One-liner

The procurement department a solopreneur can't afford — two AI agents that negotiate with each other, and PayPal escrow that only releases when the goods arrive.

## The problem

A freelancer buying supplies has three bad options: pay list price, spend hours haggling, or wire money and hope. Enterprise buyers solved this decades ago with procurement departments and escrow terms. A one-person business gets neither.

## What Parley does

Parley gives every user **two agents**:

- A **buyer agent** that searches real products (Channel3), compares offers across vendors — including other users' stores — and negotiates price through a real agent-to-agent protocol.
- A **merchant agent** that sells on your behalf: your catalog, your margin floor, your negotiation style. It counters, accepts, or walks — while you sleep.

When they close a deal, the money moves the way serious procurement does:

1. Deterministic spend policy gates the order — the model can't bypass it
2. The human approves on PayPal — the agent never sees credentials
3. PayPal **AUTHORIZE** holds the funds — no capture yet
4. Seller ships, tracking flows to the buyer's watchdog
5. Carrier DELIVERED **or** buyer confirms receipt → human releases → capture
6. Never arrives → void — escrow, not a chargeback

Then the part no demo does: **the relationship outlives the transaction**. A deal opens a buyer↔seller channel with the operational timeline in it — escrow funded, shipped, delivered, released — plus live chat. Sellers get a CRM (deals, lifetime spend, walked leads), send targeted win-back offers that convert into new escrows, and earn reviews that feed their public vendor score. If something goes wrong, a claim holds the escrow while humans talk.

## Why PayPal

The entire product is one long PayPal escrow lifecycle — Orders v2 AUTHORIZE → authorize → capture/void — plus the Agent Toolkit (invoices, disputes, transaction search, shipment tracking). PayPal isn't the checkout button; it's the settlement layer that makes agentic commerce safe enough to trust.

## What's real (not staged)

- Real product search, real merchant LLM on the other side of an MCP/JSON-RPC boundary
- Real PayPal sandbox orders — every escrow in the demo is a live authorization
- Server-resolved prices — the model picks ids, never amounts
- 37 invariant tests pinning the money rules and the relationship rules
- The unhappy path works too: claims, voids, disputes, margin floors

## Architecture

Next.js 16 + Vercel AI SDK (buyer agent) · own LLM merchant agent behind an HTTP MCP boundary · Drizzle + Neon Postgres · PayPal Orders v2 + Agent Toolkit · Channel3 product search · deterministic policy engine · append-only audit log.

## The pitch in one breath

> "Parley is the first place where your AI agent and my AI agent haggle over price like professionals, PayPal holds the money until the box shows up, and afterward we're still doing business — that's what procurement was always supposed to be."
