# Parley — demo script (< 3 min)

Recording-ready. Every beat maps to **staged prod data** — nothing is improvised.

## 0. Setup checklist (5 min before recording)

- [ ] `https://parley-wt1k.onrender.com` — open once to warm the cold start
- [ ] **Browser A**: logged in as `buyer1` — the buyer journey
- [ ] **Browser B (incognito)**: logged in as `seller1` — the ParcelPro Supply store
- [ ] Both accounts: password `ParleyJudgeDemo26`, space **"Personal"**
- [ ] PayPal **sandbox buyer** credentials at hand — you will click approve once
- [ ] A UPS-format tracking number ready, e.g. `1Z8842EW0399998888`

## Staged cast (already in prod — do not recreate)

| Item | What | Where it shows |
|---|---|---|
| ParcelPro Supply | seller1's store — 4 products, floor 85%, −10% campaign on kraft boxes | Seller dashboard, search results |
| `SEED-B1-AUTH` | Kraft mailer box $37 — **authorized**, linked to seller1's ledger, has the negotiation transcript | Pipeline "In escrow", seller Orders, order drawer replay |
| `SEED-B1-SHIP` | Bubble mailers $26.40 — **in transit** (UPS IN_TRANSIT) | Pipeline "Transit" |
| `SEED-B1-DONE` / `DONE2` | Tape $16.90 + liners $33 — **captured**; the tape order awaits a review | Pipeline "Released", My Sellers pending-review |
| `thr_b1` | Thread buyer1↔ParcelPro — **unread message waiting for the seller** | Messages, seller's sidebar badge |
| `off_b1` | Open offer: bubble mailers at **$24.20** (list $28.50) | Buyer Inbox → Accept → real escrow |
| `rev_b1` | ★5 review on the liner order | Seller rating, vendor score 100 |
| `neg_b1` | Transcript: $42 list → $37 agreed in 3 rounds | Order drawer → "How your agent negotiated" |
| Leads | Walked buyer `parley-user-7f3a9c11` at $31 → floor held at $35.70 | Seller live feed + Leads |
| 2nd customer | `HELL` also appears in seller1's CRM — 3 deals, ~$280 | Seller → Customers |

## 1. Hook — 15s

> "A solopreneur can't afford a procurement department. Parley gives them two agents instead — one that buys, one that sells — and money that waits for delivery."

Landing hero → scroll to "Beyond sourcing".

## 2. Buyer agent — 40s

In `/app` chat as `buyer1`:

1. `find kraft shipping boxes` → real Channel3 products **plus two Parley sellers** (Acme $24, ParcelPro $42 with the −10% promo badge) — *"other users' agents are in the same market"*
2. `negotiate the ParcelPro one, offer $34` → watch the merchant agent counter — a **second agent** reasoning, not a template.

## 3. Money with guardrails — 45s

3. `buy it` → order card → **open the PayPal approve link** → approve with the sandbox buyer.
   - *"The agent never touches credentials or the price — the amount came from the server, the policy check ran in code."*
4. **Pipeline** → the new card sits in "In escrow". Open **`SEED-B1-AUTH`** (kraft boxes) → drawer → *"How your agent negotiated"* → **replay the A2A transcript** bubble by bubble.
5. Switch to **Browser B**: seller1 → Orders → the kraft sale → **Ship** → paste the UPS tracking → *"the watchdog starts following the carrier, and the buyer's thread just got the tracking event."*
6. Back to **Browser A**: the kraft drawer → **Confirm receipt** → delivered. *"Real escrow releases on carrier DELIVERED or buyer confirmation — same rule as AliExpress."*

## 4. Release & reputation — 25s

7. **Inbox** → `release the payment` on the **real order you just bought** (beat 3) → captures the authorization.
   - ⚠️ Only release the order created live — `SEED-*` ids are local fixtures, not real PayPal authorizations.
8. **My sellers** → ParcelPro: 4 orders, $113.30 lifetime → the **tape order is pending review — rate it live** → the vendor score moves in front of the judges.
9. Optional beat: **report a problem** on the shipped bubble-mailer order → the claim path (escrow holds while humans talk).

## 5. Seller side — 40s

Browser B, `/seller`:

10. **Live feed** — the negotiation from beat 2 already appears; the walked lead (`parley-user-7f3a9c11`, offered $31, floor held $35.70) sits in **Leads**.
11. **Customers** → buyer1: 4 deals, $113.30 lifetime — plus `HELL` with 3 more (~$280). **Send offer** → that's `off_b1`'s flow (already sitting in the buyer's Inbox — show it).
12. **Messages** → `thr_b1`: unread badge → *"Double-tape the bottom seam"* → reply live → lands in Browser A.
13. **AI Assistant → "Try your agent"** → pick a product, offer `$30` → the agent counters at the **exact floor**. *"The margin floor is law — the agent can't break it."*

## 6. Proof it's real — 15s

14. GitHub → `npm test` — **37 invariant tests**: policy caps, merchant floor, offer floor, claim states, i18n parity.
15. README security model — invariants enforced in code, not in prompts.

## Closing line

> "Two agents meeting over MCP, PayPal escrow settling the deal, a relationship that outlives the transaction — and every guardrail in code. That's procurement a solopreneur can actually trust."

## Landmines to avoid while recording

- **Do not release `SEED-*` orders** — their PayPal ids are fixtures; capture would 404. Release only the order created live in beat 3.
- **`off_b1` accept creates a real $24.20 escrow** — that's fine, it's the offer beat; but approve it only if you want a second live order.
- Claims work on any order still holding funds (up to `delivered`) — but once `captured` the claim path is closed; run that beat before releasing if you want it.
- Stay in space **"Personal"** on both accounts.
