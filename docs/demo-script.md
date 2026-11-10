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
5. **Pipeline** → the order card sits in "In escrow" — funds held, not captured.
6. `track order <id> with UPS <tracking>` → watchdog registers it.
7. **Inbox → Check now** → the watchdog runs live; when the carrier reports DELIVERED, the release flag lands.

## 4. Release & reputation — 25s

8. `release the payment` → `confirm_delivery_release` captures the authorization. Vendor score bumps `on_time`.
9. Show the counterfactual: *"if it never arrives, `void` returns the held funds and the vendor's score drops — escrow, not a chargeback."*
10. **Analytics** → "Saved by negotiating" KPI, vendor scores, audit feed.

## 5. Seller side — 35s

Second browser, seller account, `/seller`:

11. Deployed merchant agent: floor %, style, catalog (show CSV import quickly).
12. **Live feed** — the negotiation from beat 2/3 appears in real time.
13. **Leads** — "buyers who negotiated but haven't closed" + `buyer_walked` alert in Inbox.
14. Close rate KPI + sales chart: *"the agent works while you sleep."*

## 6. Proof it's real — 20s

15. `npm test` — 24 invariant tests: policy caps, merchant floor law, demo spend gate, i18n parity.
16. README security model — 10 invariants enforced in code.

## Closing line

> "Two agents meeting over MCP, PayPal escrow settling the deal, and every guardrail in code — that's procurement a solopreneur can actually trust."

## Fallbacks

- **Cold start**: hit the landing ~30s before recording.
- **Carrier lookup flaky**: the `delivered` state can be pre-seeded; show Inbox → Check now landing it live.
- **Demo account**: if showing a second user, demo role is search-only — spend tools are blocked by design (that's a feature to show, not a bug).
