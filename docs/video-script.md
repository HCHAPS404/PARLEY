# Parley — demo video script (75–90s)

Storyboard for the hackathon submission video. VO lines are written for
ElevenLabs (confident, even pace — "Brian"/"Adam" style,
`eleven_multilingual_v2`, stability ~0.5). Every SCREEN beat maps to data
already staged in prod — nothing needs to be faked.

Production stack: OBS/Loom for capture → CapCut or DaVinci Resolve for edit →
ElevenLabs for VO → YouTube Audio Library for the ambient bed → Jitter/CapCut
for the title cards. Browser captures at 1440×900, dark theme, cursor hidden
or Screen Studio-style auto-zoom.

---

## Act 0 — Cold open (0:00–0:06)

| | |
|---|---|
| SCREEN | Black → teal line draws → title card: **"What if your supplier had an agent — and so did you?"** |
| VO | *none — let the card land* |
| MUSIC | Ambient bed fades in |

## Act 1 — The problem (0:06–0:16)

| | |
|---|---|
| SCREEN | Quick cuts: spreadsheet prices, a dozen supplier tabs, an invoice. End on the Parley landing page fading in. |
| VO | "Solopreneurs overpay for inventory because nobody has time to negotiate every purchase order. Parley fixes that — with agents that do it for you." |
| CARD | small lower-third: `parley-wt1k.onrender.com` |

## Act 2 — Search & negotiate (0:16–0:34)

| | |
|---|---|
| SCREEN | buyer1 chat — type: *"find kraft mailer boxes under $40"*. Product cards stream in with photos. Then: *"negotiate with ParcelPro."* The offer bubbles appear round by round. |
| VO | "The buyer agent searches real catalogs — and when it finds a Parley seller, it doesn't just take a price. It negotiates with the seller's own agent — a real LLM on the other side of an MCP boundary, guarding its margin floor." |
| OVERLAY | on the negotiation rounds: `round 1 · counter · round 3 · agreed $35.70` |

## Act 3 — Policy & escrow (0:34–0:50)

| | |
|---|---|
| SCREEN | Policy check flashes → PayPal approve screen (the one human click) → Pipeline kanban: card moves `authorized → shipped → delivered`. |
| VO | "No amount ever comes from the model — prices resolve server-side, a deterministic spend policy gates every order, and a human approves on PayPal. Then the money sits in escrow: authorized, not captured — until the package actually arrives." |
| OVERLAY | `AUTHORIZE → hold → capture` lifecycle strip |

## Act 4 — The other side (0:50–1:06)

| | |
|---|---|
| SCREEN | seller1 dashboard — live feed shows the negotiation that just happened; orders ledger; ship + tracking. Cut to Customers: buyer1 appears as REPEAT, $113.30 lifetime; an offer goes out. |
| VO | "On the other side, the merchant agent just made a sale — and the seller sees everything: every round, every lead that walked, every customer worth a repeat offer." |

## Act 5 — Relationship & close (1:06–1:22)

| | |
|---|---|
| SCREEN | Buyer inbox: "ParcelPro sent you an offer — Accept" → escrow created. Thread shows the deal timeline as system events. Reviews: ★5.0 vendor score on the public storefront `/s/parcelpro-supply`. |
| VO | "The deal doesn't end at delivery. Channels stay open, reviews build the vendor's score, and the seller's next offer lands one click from a new escrow. Procurement that remembers." |

## Act 6 — End card (1:22–1:30)

| | |
|---|---|
| SCREEN | Dark card — Parley logo, big type: **"procurement that negotiates"**, URL chip, judge creds small: `buyer1 / seller1 · ParleyJudgeDemo26` |
| VO | "Parley — agentic escrow on PayPal. Try it live." |
| MUSIC | bed swells, cuts on logo |

---

## VO script (clean, for ElevenLabs paste)

> Solopreneurs overpay for inventory — because nobody has time to negotiate every purchase order. Parley fixes that, with agents that do it for you.
>
> The buyer agent searches real catalogs. And when it finds a Parley seller, it doesn't just take a price — it negotiates with the seller's own agent. A real language model, on the other side of an MCP boundary, guarding its margin floor.
>
> No amount ever comes from the model. Prices resolve server-side, a deterministic spend policy gates every order, and a human approves on PayPal. Then the money sits in escrow — authorized, not captured — until the package actually arrives.
>
> On the other side, the merchant agent just made a sale. And the seller sees everything: every round, every lead that walked, every customer worth a repeat offer.
>
> The deal doesn't end at delivery. Channels stay open, reviews build the vendor's score, and the seller's next offer lands one click from a new escrow. Procurement that remembers.
>
> Parley — agentic escrow on PayPal. Try it live.

(~165 words ≈ 70–75s at a measured pace — matches the storyboard.)

## Shot list — what to capture (all staged, nothing fake)

1. `buyer1` chat: search → cards with photos → negotiate → round bubbles
2. Policy flash + PayPal approve (one real click)
3. Pipeline: the kraft $37 escrow card + shipped card w/ UPS tracking
4. `seller1` home: live feed, funnel, floor card
5. `seller1` orders: ship form + ledger
6. `seller1` customers: REPEAT cards + Send offer
7. `buyer1` inbox: offer alert w/ Accept
8. Messages thread open (deal timeline events)
9. Storefront `/s/parcelpro-supply` — score, reviews, catalog photos
10. Landing hero for the open/close frames

## Don't show

- Releasing a `SEED-*` order (fixtures — no live PayPal auth behind them)
- The "asas" space — stay on "Personal"
- Light theme, raw URLs in address bar, any real PayPal credential screen
