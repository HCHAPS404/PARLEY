# Parley Video Studio — production plan

A reproducible pipeline that turns the staged production demo into a ~95 s
submission video: open-source voice, automated operational takes, title cards,
and an ffmpeg assembly recipe. Everything lives in `scripts/video/` +
`video-build/` (gitignored output).

```
scenes.mjs        ← the manifest: 9 scenes, VO text, durations, choreography
gen-voice.mjs     → video-build/vo/*.mp3        (edge-tts, neural voices, free)
takes.mjs         → video-build/takes/*-rec/*.webm  (Playwright + Edge)
title-cards.mjs   → video-build/cards/*.png     (Parley-styled 1600×900)
assemble.mjs      → video-build/parley-demo.mp4 (needs ffmpeg: winget install Gyan.FFmpeg)
```

## Voice — open-source, no ElevenLabs

**Primary: edge-tts** (LGPL, Microsoft neural voices — Aria/Andrew/Brian/Guy;
indistinguishable-in-demo quality, zero API key, streams to mp3).
`uv tool install edge-tts` → `node scripts/video/gen-voice.mjs`.
Current voice: `en-US-AndrewNeural` at +2%. Alternatives that fit the tone:
`en-US-BrianNeural` (warmer), `en-US-ChristopherNeural` (deeper).

**Fully-offline alternative: Piper** (MIT, runs local). Download
`piper_windows_amd64.zip` + voice `en_US-ryan-high.onnx` from the Piper
releases/huggingface, then `piper -m en_US-ryan-high.onnx -f out.wav` per line
in `scenes.mjs`. Slightly more robotic than edge-tts; use only if Edge TTS
can't reach the network.

**Highest quality: Kokoro-82M** (`pip install kokoro-onnx`, needs espeak-ng on
Windows — heavier setup). Swap into `gen-voice.mjs` if you want genuinely
local state-of-the-art.

## Shot list & direction (the actual directing)

Format: `[scene · dur] picture — camera — VO`.

| # | Scene | Picture (what's on screen) | Camera / movement | VO (edge-tts) |
|---|-------|----------------------------|-------------------|----------------|
| 00 | Cold open · 5 s | Title card: "Your agent just saved you $5.00." | Static card, teal underline accent. Cut to black 4 frames at end. | — (silence + music swell) |
| 01 | The ask · 12 s | Buyer chat, empty composer → typed message "I need shipping supplies for my bakery launch" → agent replies with product cards | Cursor glides to composer, real-time typing @55 cps, hold on cards; smooth scroll to bottom | "Meet Parley — an AI buyer that finds real products, then negotiates for them." |
| 02 | Negotiation · 14 s | Same thread — the negotiation rounds list↔counter↔agreed | **Zoom-in 1.35×** centered on the round list (transform-origin on element), hold 6 s, zoom back out | "Two agents talk to each other. The seller's agent defends its floor — yours pushes back. Every cent is settled server-side, never from a prompt." |
| 03 | Escrow · 12 s | Pipeline kanban — the `authorized` column with the PackRight wrap card | Zoom 1.3× on the AUTHORIZED badge, cursor glides to the Approve control (hover, no click) | "Payment goes into PayPal escrow — authorized, not captured. The money sits protected until the box arrives." |
| 04 | Delivery & receipt · 13 s | Order drawer opens on the Kraft order → tracking row scrolls in → click **Receipt** → Parley invoice page | Click-through at natural pace; hard cut on the receipt render — the invoice *is* the payoff | "Track the shipment in-line. When it lands, confirm delivery — the escrow releases, and Parley writes the receipt for you." |
| 05 | Seller side · 14 s | Seller home (ParcelPro): live event feed, campaign card, funnel counters | Slow scroll down the feed; **zoom 1.3×** on a counter/walk event row | "On the other side, a merchant agent closes deals while the seller sleeps — campaigns, price floors, and a live feed of every counter-offer." |
| 06 | Relationships · 11 s | Messages: open PackRight thread — pinned bulk-pricing note + photo bubble | Click first thread; **zoom 1.35×** on the pinned strip; hold; zoom out | "Deals become relationships — direct threads, pinned bulk pricing, photos of what actually arrived." |
| 07 | Trust · 9 s | Public storefront `/s/parcelpro-supply` — score ★, promo prices, reviews | Slow scroll 500 px over products; no cursor needed | "Public storefronts. Vendor scores. Reviews on real, escrowed orders." |
| 08 | End card · 8 s | Logo + "Parley — procurement that negotiates" + URL + judge creds | Static; teal accent bar. Fade to black last 12 frames. | "Parley. Procurement that negotiates." |

### Coverage rules used in takes.mjs

- **Cursor**: injected glowing teal dot (`CURSOR_INIT`) follows real CDP mouse
  events; click = expanding ripple. It reads as intentional on camera.
- **Zoom**: CSS `transform: scale()` on `<html>` with `transform-origin` at the
  target element's center and a 0.9 s cubic-bezier ease — a true camera
  zoom-in/zoom-out baked into the take, no editor keyframes needed.
- **Pacing**: 0.8–1.2 s settle after every scroll/zoom before the next action;
  never cut mid-animation.
- **Viewport**: 1600×900 (16:9) — matches YouTube/DevPost players exactly.

## Assembly

`assemble.mjs` normalizes every source to `seg/*.mp4` (1600×900 @30 fps,
yuv420p), muxes the scene VO under it, then `ffmpeg -f concat` →
`video-build/parley-demo.mp4` (crf 19, aac 160k). It also emits
`concat.txt` + `vo/captions.srt` (burn-in optional:
`-vf subtitles=video-build/vo/captions.srt`).

No ffmpeg? `winget install Gyan.FFmpeg` then re-run — or drop the segments
into Clipchamp/DaVinci in manifest order and align each VO mp3 to its segment.

## Music & mix

- Track: ambient/minimal electronic, 90–110 BPM (YouTube Audio Library —
  e.g. "Airport Lounge"-class). Duck under VO at **−20 dB**, swell to −8 dB on
  the cold-open and end cards.
- Loudness target: −14 LUFS integrated, ≤ −1 dBTP (YouTube norm).

## Retake recipe

Scene went stale or the UI changed? `node scripts/video/takes.mjs 02` re-shoots
only scene 02; `gen-voice` re-renders only what you changed in `scenes.mjs`;
`assemble` rebuilds the cut. The manifest is the single source of truth.
