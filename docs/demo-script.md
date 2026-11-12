# Parley — demo script (< 3 min)

The golden path. Each beat maps to something a judge can verify — nothing staged.

## 0. Setup (before recording)

- Prod deploy live: `https://parley-wt1k.onrender.com` — cold-start once beforehand
- Admin account logged in; Acme Supply Co. seller account ready in a second browser/incognito
- Sandbox buyer PayPal credentials at hand for the approval step
- A tracking number ready (e.g. a UPS-format `1Z…` — sandbox accepts it)

## 1. Hook — 15s

> "A solopreneur can't afford a procurement department. Parley gives them two agents instead — one that buys, one that sells — and money that waits for delivery."

Show the landing briefly — hero + the "Beyond sourcing" section.

## 2. Buyer agent — 40s

In `/app` chat:

1. `find a condenser microphone under $100` → real products, images, prices, vendor scores, **links to the real listings**
2. `what's the market like for these?` → `market_report` — catalog depth, price spread, 90-day sparkline. *"It's real market data, not made-up trends."*
3. `negotiate the best one` → watch the transcript: the **merchant LLM agent** counters — that's a second agent reasoning, not a template.

## 3. Money with guardrails — 40s

4. `buy it` → order card appears → **open the PayPal approval link** → approve with sandbox buyer.
   - *"The agent never touches my credentials or the price — the amount came from the server, the policy check ran in code."*
5. **Pipeline** → the order card sits in "In escrow" — funds held, not captured. **Open the drawer** → *"How your agent negotiated"* replays the A2A transcript bubble by bubble.
6. Seller ships (second browser: Orders → tracking) → the thread gets a system event *and* the watchdog starts tracking the carrier.
7. **Buyer confirms receipt** — *"Ya me llegó"* in the drawer → delivered. Real escrow releases on carrier DELIVERED *or* buyer confirmation, whichever comes first — same rule as AliExpress.

## 4. Release & reputation — 25s

8. Inbox → `release the payment` → captures the authorization. The thread logs *"Escrow released — deal complete."*
9. Show the counterfactual: *"if it never arrives, `void` returns the held funds — escrow, not a chargeback."*
10. **My sellers** → rate the order ★5 → the vendor's global score updates — *"reputation is earned, not declared."*
11. **Analytics** → "Saved by negotiating" KPI, vendor scores, audit feed.

## 5. Seller side — 35s

Second browser, seller account, `/seller`:

12. Deployed merchant agent: floor %, style, catalog (CSV import quickly).
13. **Customers** → the buyer is already a CRM record: deals, lifetime spend — **send a targeted offer** back (win-back pricing, floor enforced).
14. Buyer side: offer lands in **Inbox** → accept → *new escrow, same guardrails.*
15. **Messages** → the thread has the whole deal timeline: negotiation close, escrow funded, tracking, delivery, release — plus live chat.
16. **AI Assistant → "Try your agent"** — throw a low offer at the merchant agent live → watch it counter at the exact floor.
17. **Claim path** (optional beat): buyer reports a problem → seller sees `claim open` → resolve → *"escrow holds while humans talk."*

## 6. Proof it's real — 20s

18. `npm test` — 37 invariant tests: policy caps, merchant floor law, offer floor, claim states, demo spend gate, i18n parity.
19. README security model — invariants enforced in code.

## Closing line

> "Two agents meeting over MCP, PayPal escrow settling the deal, a relationship that outlives the transaction — and every guardrail in code. That's procurement a solopreneur can actually trust."

## Fallbacks

- **Cold start**: hit the landing ~30s before recording.
- **Delivery**: `confirm_received` is the canonical path (carriers never report in sandbox); the watchdog path also works if a real tracker is attached.
- **Demo account**: if showing a second user, demo role is search-only — spend tools are blocked by design (that's a feature to show, not a bug).
