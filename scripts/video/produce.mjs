/**
 * Parley film producer — voice → timeline → takes/slides → music → master.
 *
 *   node scripts/video/produce.mjs                 full build (cached steps reused)
 *   node scripts/video/produce.mjs --redo=pipeline,receipt   re-shoot those segments
 *   node scripts/video/produce.mjs --assemble      only re-mix/re-cut from existing clips
 *
 * Output: video-build/parley-pitch.mp4 (1920×1080 · 30 fps · H.264 high · AAC 256k,
 * −14 LUFS) + video-build/parley-pitch.srt
 * Needs: ffmpeg/ffprobe on PATH, `edge-tts` (uv tool install edge-tts), `uv`, Edge.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { FILM, TIMING, VOICE } from "./script.mjs";
import { slideHtml } from "./slides.mjs";
import { SHOTS } from "./shots.mjs";
import { CURSOR_INIT, Take, VIEW, settle } from "./lib/recorder.mjs";

const BASE = "https://parley-wt1k.onrender.com";
const PASS = "ParleyJudgeDemo26";
const LOGIN = { buyer: "buyer1", seller: "seller1" };
const OUT = path.join(process.cwd(), "video-build");
const dirs = ["vo", "frames", "clips"].map((d) => path.join(OUT, d));
dirs.forEach((d) => mkdirSync(d, { recursive: true }));
const [VO_DIR, FRAMES, CLIPS] = dirs;

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const redo = new Set(String(args.redo ?? "").split(",").filter(Boolean));

const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { stdio: "pipe", maxBuffer: 1 << 28, ...opts }).toString();
const probe = (f) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
const log = (...m) => console.log("·", ...m);

// ─── 1. Voice ──────────────────────────────────────────────────────────────
for (const s of FILM) {
  const h = createHash("sha1").update(VOICE.name + VOICE.rate + VOICE.pitch + s.vo).digest("hex").slice(0, 8);
  s.voFile = path.join(VO_DIR, `${s.id}-${h}.mp3`);
  if (!existsSync(s.voFile) || statSync(s.voFile).size < 2000) {
    for (let i = 0; ; i++) {
      try {
        run("edge-tts", ["--voice", VOICE.name, `--rate=${VOICE.rate}`, `--pitch=${VOICE.pitch}`, "--text", s.vo, "--write-media", s.voFile]);
        if (statSync(s.voFile).size > 2000 && probe(s.voFile) > 0.3) break;
      } catch (e) { if (i >= 4) throw e; }
      await new Promise((r) => setTimeout(r, 2000));
    }
    log("voice", s.id);
  }
  s.voDur = probe(s.voFile);
}

// ─── 2. Timeline ───────────────────────────────────────────────────────────
// Segment k lasts d_k; it starts when segment k-1 begins its outgoing xfade.
const segs = [];
for (const s of FILM) for (const g of s.segments) segs.push({ ...g, section: s });
segs.forEach((g, k) => {
  g.k = k;
  g.name = g.slide ?? g.take;
  g.xIn = k === 0 ? 0 : TIMING.xfade[g.in ?? "fade"];
});
for (const s of FILM) {
  const mine = segs.filter((g) => g.section === s);
  const need = TIMING.lead + s.voDur + TIMING.pad + (s.tail ?? 0);
  const total = mine.reduce((a, g) => a + (g.share ?? 1 / mine.length), 0);
  for (const g of mine) {
    const next = segs[g.k + 1];
    g.dur = need * ((g.share ?? 1 / mine.length) / total) + (next ? next.xIn : 0);
  }
}
let t = 0;
segs.forEach((g, k) => {
  g.start = k === 0 ? 0 : t - g.xIn;
  t = g.start + g.dur;
});
const TOTAL = t;
for (const s of FILM) s.voAt = segs.find((g) => g.section === s).start + TIMING.lead;
log(`timeline ${TOTAL.toFixed(1)}s · ${segs.length} segments`);

// ─── 3. Record ─────────────────────────────────────────────────────────────
const clipOf = (g) => path.join(CLIPS, `${String(g.k).padStart(2, "0")}-${g.name}.mp4`);
const todo = args.assemble ? [] : segs.filter((g) => redo.has(g.name) || !existsSync(clipOf(g)));

function encodeClip(g, dir) {
  run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "frames.ffconcat"),
    "-vf", `fps=30,scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration=4,format=yuv420p`,
    "-t", g.dur.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-an", clipOf(g)]);
}

if (todo.length) {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctxs = {};
  async function pageFor(role, viewport = VIEW) {
    const key = role ?? "public";
    if (ctxs[key]) return ctxs[key];
    const ctx = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr, locale: "en-US", colorScheme: "light",
    });
    await ctx.addInitScript(() => { try { localStorage.setItem("parley_onboarded", "1"); localStorage.removeItem("parley:active-conv"); } catch {} });
    await ctx.addInitScript(CURSOR_INIT);
    if (role) {
      const r = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: LOGIN[role], password: PASS }, timeout: 120_000 });
      if (!r.ok()) throw new Error(`login ${role} → ${r.status()}`);
    }
    const page = await ctx.newPage();
    ctxs[key] = { ctx, page };
    return ctxs[key];
  }
  const slidePage = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();

  for (const g of todo) {
    const dir = path.join(FRAMES, `${String(g.k).padStart(2, "0")}-${g.name}`);
    log(`record ${g.name} (${g.dur.toFixed(1)}s)`);
    if (g.slide) {
      await slidePage.setContent(slideHtml(g.slide, g.dur), { waitUntil: "networkidle" });
      await slidePage.evaluate(() => document.fonts.ready);
      await slidePage.waitForTimeout(500);
      const take = new Take(slidePage, dir);
      await take.start();
      await slidePage.evaluate(() => document.body.classList.add("go"));
      await take.holdUntil(g.dur + 0.2);
      await take.stop();
    } else {
      const shot = SHOTS[g.take];
      const { ctx, page } = await pageFor(shot.as);
      if (shot.space) await ctx.request.post(`${BASE}/api/spaces/active`, { data: { id: shot.space } });
      if (shot.url) {
        await page.goto(BASE + shot.url, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await settle(page, 1200);
      }
      await page.evaluate(() => { document.documentElement.style.transform = ""; });
      const take = new Take(page, dir);
      await take.start();
      try { await shot.run(page, take, g.dur); } catch (e) { console.log(`  ! ${g.name}: ${e.message.split("\n")[0]}`); }
      await take.holdUntil(g.dur + 0.2);
      const r = await take.stop();
      log(`  ${r.frames} frames, ${r.duration.toFixed(1)}s`);
    }
    encodeClip(g, dir);
  }
  await browser.close();
}

// ─── 3b. Fit the timeline to what was actually filmed ─────────────────────
// A take may run longer than planned (the live agent took its time); keep
// the whole take and let the section breathe instead of cutting the payoff.
for (const g of segs) {
  if (!g.take) continue;
  const list = path.join(FRAMES, `${String(g.k).padStart(2, "0")}-${g.name}`, "frames.ffconcat");
  if (!existsSync(list)) continue;
  const actual = [...readFileSync(list, "utf8").matchAll(/duration ([\d.]+)/g)].reduce((a, m) => a + Number(m[1]), 0);
  const live = ["buyerAsk", "buyerOrder", "sellerCopilot"].includes(g.name);
  const want = live ? actual - 0.15 : Math.min(actual - 0.15, g.dur * 1.5);
  if (want > g.dur + 0.4) {
    g.dur = want;
    if (existsSync(clipOf(g)) && probe(clipOf(g)) < g.dur - 0.2) {
      log(`refit ${g.name} → ${g.dur.toFixed(1)}s`);
      encodeClip(g, path.dirname(list));
    }
  }
}
t = 0;
segs.forEach((g, k) => {
  g.start = k === 0 ? 0 : t - g.xIn;
  t = g.start + g.dur;
});
const FINAL = t;
for (const s of FILM) s.voAt = segs.find((g) => g.section === s).start + TIMING.lead;
log(`final cut ${FINAL.toFixed(1)}s`);

// ─── 4. Music (original, synthesized — no licensing) ───────────────────────
const music = path.join(OUT, `music-${Math.ceil(FINAL)}.wav`);
if (!existsSync(music)) {
  run("uv", ["run", "--with", "numpy", path.join("scripts", "video", "music.py"), String(Math.ceil(FINAL) + 1), music]);
  log("music", path.basename(music));
}

// ─── 5. Master ─────────────────────────────────────────────────────────────
const inputs = [];
const fc = [];
segs.forEach((g) => inputs.push("-i", clipOf(g)));
segs.forEach((g, k) => fc.push(`[${k}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v${k}]`));
let prev = "v0";
segs.slice(1).forEach((g) => {
  const o = `x${g.k}`;
  fc.push(`[${prev}][v${g.k}]xfade=transition=${g.in ?? "fade"}:duration=${g.xIn}:offset=${g.start.toFixed(3)}[${o}]`);
  prev = o;
});
fc.push(`[${prev}]fade=t=in:st=0:d=0.6,fade=t=out:st=${(FINAL - 1.2).toFixed(3)}:d=1.2[vout]`);

const voBase = segs.length;
FILM.forEach((s, i) => {
  inputs.push("-i", s.voFile);
  const ms = Math.round(s.voAt * 1000);
  fc.push(`[${voBase + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[a${i}]`);
});
fc.push(`${FILM.map((_, i) => `[a${i}]`).join("")}amix=inputs=${FILM.length}:normalize=0:duration=longest,apad,atrim=0:${FINAL.toFixed(3)},` +
  `highpass=f=75,equalizer=f=220:t=q:w=1:g=1.5,equalizer=f=3300:t=q:w=1.3:g=2.5,equalizer=f=7500:t=q:w=1:g=-1.5,` +
  `acompressor=threshold=-21dB:ratio=3:attack=6:release=140:makeup=2.5,asplit=2[vo][key]`);
inputs.push("-i", music);
const mi = voBase + FILM.length;
fc.push(`[${mi}:a]aresample=48000,atrim=0:${FINAL.toFixed(3)},highpass=f=70,volume=-8dB[mus]`);
fc.push(`[mus][key]sidechaincompress=threshold=0.025:ratio=6:attack=25:release=480:makeup=1[duck]`);
fc.push(`[vo][duck]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,` +
  `afade=t=in:st=0:d=0.8,afade=t=out:st=${(FINAL - 1.6).toFixed(3)}:d=1.6[aout]`);

const master = path.join(OUT, "parley-pitch.mp4");
writeFileSync(path.join(OUT, "filter.txt"), fc.join(";\n"));
log("mastering…");
run("ffmpeg", ["-y", "-v", "error", ...inputs, "-/filter_complex", path.join(OUT, "filter.txt"),
  "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-profile:v", "high",
  "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", master]);

// captions — timed to the real VO placement
const ts = (x) => {
  const ms = Math.round(x * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
writeFileSync(path.join(OUT, "parley-pitch.srt"),
  FILM.map((s, i) => `${i + 1}\n${ts(s.voAt)} --> ${ts(s.voAt + s.voDur)}\n${s.vo}\n`).join("\n"));
log(`★ ${master} (${probe(master).toFixed(1)}s)`);
