# Parley Video Studio

One command turns the live production demo into the submission film:
`video-build/parley-pitch.mp4` — 1920×1080 · 30 fps · H.264 high · AAC 256k ·
−14 LUFS, plus `parley-pitch.srt` captions timed to the real voice-over.

```
node scripts/video/produce.mjs                          # full build, cached steps reused
node scripts/video/produce.mjs --redo=pipeline,receipt  # re-shoot specific segments
node scripts/video/produce.mjs --assemble               # re-cut/re-mix from existing clips
```

Requirements: ffmpeg 9+ on PATH (`winget install Gyan.FFmpeg`), `edge-tts`
(`uv tool install edge-tts`), `uv` (for numpy), Microsoft Edge, `npm i`.

## Pipeline

| Step | File | What it does |
|---|---|---|
| Script | `scripts/video/script.mjs` | 13 sections: one VO line + one or more segments (slide or take), transitions, timing |
| Voice | `produce.mjs` §1 | edge-tts `en-US-AndrewMultilingualNeural`, cached by text hash |
| Timeline | `produce.mjs` §2 | section length = lead + VO + breathing room; segments split it by `share`; xfade overlap accounted |
| Slides | `scripts/video/slides.mjs` | HTML/CSS motion graphics (staggered reveals, drawn escrow rail, drift camera) at 1920×1080 |
| Takes | `scripts/video/shots.mjs` | choreography per shot: glides, clicks, typed prompts, eased CSS zoom-ins/outs, live agent runs |
| Recorder | `scripts/video/lib/recorder.mjs` | CDP screencast (JPEG q92 at device res) — starts only after the page settles, keeps real frame timestamps, fast-forwards agent waits to a target length with an on-screen "sped up" badge |
| Refit | `produce.mjs` §3b | live takes keep their full length; others capped at 1.5× plan |
| Music | `scripts/video/music.py` | original synthesized bed (pads, pluck arpeggio, sub, soft drums, plate reverb) — no samples, no licensing |
| Master | `produce.mjs` §5 | xfade chain (`slideleft` slide↔video, `fade` video↔video), VO EQ + compression, music side-chain ducking, loudnorm −14 LUFS |

## Why this design

- **No white frames / no low bitrate**: Playwright `recordVideo` is ~1 Mbps VP9 and starts before paint; the screencast recorder avoids both.
- **Real product, not mockups**: takes hit production (`parley-wt1k.onrender.com`) with the staged judge accounts; the buyer agent and seller copilot run live.
- **Copyright-free audio**: voice is TTS, music is generated from code.

Note: live takes create real records in prod (a conversation and a `created`
order in buyer1's "Bakery launch" space).
