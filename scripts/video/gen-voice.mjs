/**
 * Generates the voiceover for every scene via edge-tts (open-source,
 * Microsoft neural voices — no API key, no local model).
 *   npx tsx scripts/video/gen-voice.mts   → video-build/vo/NN-scene.mp3
 * Piper alternative (fully offline): see docs/video-studio.md.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SCENES, VOICE, VOICE_RATE } from "./scenes.mjs";

const out = path.join(process.cwd(), "video-build", "vo");
mkdirSync(out, { recursive: true });

for (const s of SCENES) {
  if (!s.vo) continue;
  const file = path.join(out, `${s.id}.mp3`);
  if (existsSync(file)) { console.log(`→ ${s.id} … cached`); continue; }
  process.stdout.write(`→ ${s.id} … `);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      execFileSync(
        "edge-tts",
        ["--voice", VOICE, `--rate=${VOICE_RATE}`, "--text", s.vo, "--write-media", file],
        { stdio: "pipe" },
      );
      break;
    } catch {
      if (attempt === 3) throw new Error(`${s.id}: edge-tts failed after 4 tries`);
      execFileSync("ping", ["-n", "3", "127.0.0.1"], { stdio: "pipe" }); // ~2s backoff
    }
  }
  console.log("ok");
}

// SRT captions — one cue per scene, sequenced by target durations.
let t = 0;
const fmt = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return `${h}:${m}:${sec},000`;
};
let idx = 1;
let srt = "";
for (const s of SCENES) {
  if (s.vo) srt += `${idx++}\n${fmt(t)} --> ${fmt(t + s.dur)}\n${s.vo}\n\n`;
  t += s.dur;
}
writeFileSync(path.join(out, "captions.srt"), srt);
console.log(`done → ${out} (+ captions.srt)`);
