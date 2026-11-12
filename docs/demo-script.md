# Parley — demo script (< 3 min)

Recording-ready. Every beat maps to **staged prod data** — nothing is improvised.

## 0. Setup checklist (5 min before recording)

- [ ] `https://parley-wt1k.onrender.com` — open once to warm the cold start
- [ ] **Browser A**: logged in as `HELL` (admin, buyer) — stays on the buyer journey
- [ ] **Browser B (incognito)**: logged in as `seller1` — the ParcelPro Supply store
- [ ] Both in the **"Personal"** space (space switcher, top of sidebar)
- [ ] PayPal **sandbox buyer** credentials at hand — you will click approve once
- [ ] A UPS-format tracking number ready, e.g. `1Z8842EW0312345678`

## Staged cast (already in prod — do not recreate)

| Item | What | Where it shows |
|---|---|---|
| ParcelPro Supply | seller1's store — 4 products, floor 85%, −10% campaign on kraft boxes | Seller dashboard, search results |
| `SEED-08A908X` | Poly Voyager $99.99 — **authorized**, linked to seller1's ledger | Pipeline "In escrow", seller Orders |
| `thr_demo` | Thread HELL↔ParcelPro — unread message waiting for the seller | Messages, sidebar badge |
| `off_demo1` | Open offer: kraft boxes at **$35.70** (list $42) | Buyer Inbox → Accept → real escrow |
| `rev_demo1` | ★5 review on the delivered Keychron order | Seller rating, vendor score 100 |
| `neg_demo1` | Transcript of the Voyager negotiation ($119.99 → $99.99) | Order drawer → "How your agent negotiated" |
| Leads/events | Walked buyer `parley-user-7f3a9c11` at $31 → floor held at $35.70 | Seller live feed + Leads |

## 1. Hook — 15s

> "A solopreneur can't afford a procurement department. Parley gives them two agents instead — one that buys, one that sells — and money that waits for delivery."

Landing hero → scroll to "Beyond sourcing".

## 2. Buyer agent — 40s

In `/app` chat:

1. `find kraft shipping boxes` → real Channel3 products **plus two Parley sellers** (Acme $24, ParcelPro $42 with the −10% promo badge) — *"other users' agents are in the same market"*
2. `negotiate the ParcelPro one, offer $36` → watch the merchant agent counter — a **second agent** reasoning, not a template. It counters near $35.70–$37.

## 3. Money with guardrails — 45s

3. `buy it` → order card → **open the PayPal approve link** → approve with the sandbox buyer.
   - *"The agent never touches credentials or the price — the amount came from the server, policy check ran in code."*
4. **Pipeline** → the new card sits in "In escrow". Open **`SEED-08A908X`** (the Voyager) → drawer → *"How your agent negotiated"* → **replay the A2A transcript** bubble by bubble.
5. Switch to **Browser B**: seller1's Orders → the Voyager sale → **Ship** → paste the UPS tracking → *"the watchdog starts following the carrier."*
6. Back to **Browser A**: the Voyager drawer → **"Ya me llegó / Confirm receipt"** → delivered. *"Real escrow releases on carrier DELIVERED or buyer confirmation — same rule as AliExpress."*

## 4. Release & reputation — 25s

7. **Inbox** → `release the payment` on the **real order you just bought** (beat 3) → captures the authorization.
   - ⚠️ Only release the order created live — the `SEED-*` rows are local fixtures, their PayPal ids aren't real authorizations.
8. Thread: the timeline shows *deal closed → escrow funded → shipped → confirmed → released*.
9. **My sellers** → ParcelPro: 3 orders, $284.97 lifetime → the ★5 review is there, and the **Brio webcam is pending review — rate it live** → the vendor score moves in front of the judges.

## 5. Seller side — 40s

Browser B, `/seller`:

10. **Live feed** — the negotiation from beat 2 already appears; the walked lead (`parley-user-7f3a9c11`, offered $31, floor held $35.70) sits in **Leads**.
11. **Customers** → HELL: 3 deals, $284 lifetime → **Send offer** → that's `off_demo1`'s flow — or show the one already sent.
12. **Messages** → `thr_demo`: unread badge → reply to the buyer live → it lands in Browser A.
13. **AI Assistant → "Try your agent"** → pick a product, offer `$30` → the agent counters at the **exact floor $35.70**. *"The margin floor is law — the agent can't break it."*
14. Optional: claim path — Browser A reports a problem on the Voyager → seller sees `claim open` → resolves.

## 6. Proof it's real — 15s

15. GitHub → `npm test` — **37 invariant tests**: policy caps, merchant floor, offer floor, claim states, i18n parity.
16. README security model — invariants enforced in code, not in prompts.

## Closing line

> "Two agents meeting over MCP, PayPal escrow settling the deal, a relationship that outlives the transaction — and every guardrail in code. That's procurement a solopreneur can actually trust."

## Landmines to avoid while recording

- **Do not release `SEED-*` orders** — their PayPal ids are fixtures; capture would 404. Release only the order created live.
- **`off_demo1` accept creates a real $35.70 escrow** — that's fine, it's the offer beat; but approve it only if you want a second live order.
- Claims work on any order still holding funds (up to `delivered`) — but once it's `captured` the claim path is closed, so run that beat before releasing if you want it.
- Seller has a second space "asas" — stay in "Personal".
