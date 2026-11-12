/**
 * Renders the `title` scenes as Parley-styled PNG cards via Edge.
 *   node scripts/video/title-cards.mjs → video-build/cards/NN.png (1600×900)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCENES } from "./scenes.mjs";

const OUT = path.join(process.cwd(), "video-build", "cards");
mkdirSync(OUT, { recursive: true });

const html = (s, end) => `<!doctype html><html><body style="margin:0">
<div style="width:1600px;height:900px;background:#060a09;color:#eef2f0;
  font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;
  justify-content:center;padding:0 120px;position:relative;overflow:hidden">
  <div style="position:absolute;inset:0;background:
    radial-gradient(60% 50% at 80% 20%, rgba(45,212,191,.14), transparent 70%),
    radial-gradient(40% 40% at 15% 85%, rgba(45,212,191,.08), transparent 70%)"></div>
  ${end ? `<div style="display:flex;align-items:center;gap:22px;margin-bottom:34px">
    <img src="file:///${path.join(process.cwd(), "public", "icon.svg").replace(/\\/g, "/")}"
      style="width:74px;height:74px"/></div>` : ""}
  <div style="font-size:${end ? 110 : 74}px;font-weight:800;letter-spacing:-.03em;
    line-height:1.04;max-width:1200px">${s.headline}</div>
  <div style="margin-top:26px;font-size:32px;color:#2dd4bf;font-weight:600;
    letter-spacing:.01em">${s.subline}</div>
  ${end ? `<div style="margin-top:70px;font-size:22px;color:#8fa39d">
    buyer1 · seller1 — ParleyJudgeDemo26</div>` : ""}
  <div style="position:absolute;left:120px;bottom:64px;width:64px;height:5px;
    background:#2dd4bf;border-radius:3px"></div>
</div></body></html>`;

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const s of SCENES) {
  if (s.kind !== "title") continue;
  await page.setContent(html(s, s.id.startsWith("08")), { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${s.id}.png`) });
  console.log(`✓ ${s.id}.png`);
}
await browser.close();
