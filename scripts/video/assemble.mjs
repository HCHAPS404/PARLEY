/**
 * Assembles the final cut once takes + VO exist.
 *   node scripts/video/assemble.mjs → video-build/parley-demo.mp4 (if ffmpeg present)
 * Without ffmpeg it prints the exact command and writes concat.txt + a
 * step-by-step fallback recipe for Clipchamp/DaVinci.
 *
 * Install ffmpeg on Windows:  winget install Gyan.FFmpeg
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SCENES } from "./scenes.mjs";

const B = path.join(process.cwd(), "video-build");
const ffmpeg = (() => {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
})();

const take = (id) => {
  const d = path.join(B, "takes", `${id}-rec`);
  if (!existsSync(d)) return null;
  const f = readdirSync(d).find((x) => x.endsWith(".webm"));
  return f ? path.join(d, f) : null;
};
const card = (id) => path.join(B, "cards", `${id}.png`);
const vo = (id) => path.join(B, "vo", `${id}.mp3`);

// Build per-scene mp4 segments (uniform 1600×900 @30fps + scene VO or 1.2s
// silence pad for title cards), then concat + caption burn-in optional.
mkdirSync(path.join(B, "seg"), { recursive: true });
const manifest = [];
for (const s of SCENES) {
  if (s.kind === "title") {
    if (!existsSync(card(s.id))) { console.log(`⚠ missing card ${s.id}.png — run title-cards.mjs`); continue; }
    manifest.push({ id: s.id, src: card(s.id), dur: s.dur, vo: existsSync(vo(s.id)) ? vo(s.id) : null });
  } else {
    const t = take(s.id);
    if (!t) { console.log(`⚠ missing take for ${s.id} — run takes.mjs`); continue; }
    manifest.push({ id: s.id, src: t, dur: s.dur, vo: existsSync(vo(s.id)) ? vo(s.id) : null });
  }
}

const concatLines = [];
for (const m of manifest) {
  const seg = path.join(B, "seg", `${m.id}.mp4`);
  const isImg = m.src.endsWith(".png");
  const base = isImg
    ? `ffmpeg -y -loop 1 -t ${m.dur} -i "${m.src}" -f lavfi -i anullsrc=r=48000:cl=stereo -shortest -vf scale=1600:900 -c:v libx264 -pix_fmt yuv420p -c:a aac -r 30 "${seg}"`
    : `ffmpeg -y -i "${m.src}" -vf "scale=1600:900:force_original_aspect_ratio=decrease,pad=1600:900:(ow-iw)/2:(oh-ih)/2" -an -c:v libx264 -pix_fmt yuv420p -r 30 "${seg}"`;
  if (!ffmpeg) concatLines.push(`# ${base}`);
  else {
    try { execSync(base, { stdio: "pipe" }); console.log(`seg ${m.id} ok`); } catch { console.log(`seg ${m.id} FAIL`); continue; }
  }
  if (m.vo && existsSync(m.vo)) {
    const segA = seg.replace(".mp4", "-a.mp4");
    const mix = `ffmpeg -y -i "${seg}" -i "${m.vo}" -map 0:v -map 1:a -c:v copy -c:a aac -ar 48000 -ac 2 -shortest "${segA}"`;
    if (ffmpeg) { execSync(mix, { stdio: "pipe" }); }
    else concatLines.push(`# ${mix}`);
    concatLines.push(`file '${segA.replace(/\\/g, "/")}'`);
  } else {
    concatLines.push(`file '${seg.replace(/\\/g, "/")}'`);
  }
}
writeFileSync(path.join(B, "concat.txt"), concatLines.join("\n") + "\n");

if (ffmpeg) {
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${path.join(B, "concat.txt")}" -c:v libx264 -pix_fmt yuv420p -crf 19 -c:a aac -b:a 160k "${path.join(B, "parley-demo.mp4")}"`,
    { stdio: "inherit" },
  );
  console.log("★ video-build/parley-demo.mp4");
} else {
  console.log("\nffmpeg not found — concat.txt + recipe written.");
  console.log("Install:  winget install Gyan.FFmpeg  then re-run this script.");
  console.log("Or in Clipchamp/DaVinci: drop segments + VO in scene order (see scenes.mjs).");
}
