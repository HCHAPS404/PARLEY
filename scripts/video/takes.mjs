/**
 * Automated operational takes — records every `take` scene to webm with a
 * choreographed glowing cursor, smooth zooms and typed input.
 *   node scripts/video/takes.mjs            → video-build/takes/NN.webm
 *   node scripts/video/takes.mjs 01 05      → only scenes 01 and 05
 * Requires Edge/Chrome installed (channel: msedge). Hits production.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SCENES } from "./scenes.mjs";

const BASE = "https://parley-wt1k.onrender.com";
const PASS = "ParleyJudgeDemo26";
const LOGIN = { buyer: "buyer", seller: "seller" }; // → buyer@parley.dev / seller@parley.dev
const OUT = path.join(process.cwd(), "video-build", "takes");
const only = process.argv.slice(2);

/** Injected visible cursor — a glowing teal dot that follows real CDP mouse
 *  events, plus a ripple on click. This is what makes the take look directed. */
const CURSOR_INIT = () => {
  const c = document.createElement("div");
  c.id = "__cursor";
  c.style.cssText =
    "position:fixed;width:22px;height:22px;border-radius:50%;" +
    "background:rgba(45,212,191,.85);box-shadow:0 0 14px 4px rgba(45,212,191,.5);" +
    "pointer-events:none;z-index:2147483647;left:-40px;top:-40px;" +
    "transition:transform .08s ease-out;";
  document.body.appendChild(c);
  addEventListener("mousemove", (e) => {
    c.style.left = e.clientX - 11 + "px";
    c.style.top = e.clientY - 11 + "px";
  });
  addEventListener("mousedown", () => {
    c.style.transform = "scale(2.1)";
    c.style.background = "rgba(45,212,191,.35)";
  });
  addEventListener("mouseup", () => {
    c.style.transform = "scale(1)";
    c.style.background = "rgba(45,212,191,.85)";
  });
};

/** Session via API — the parley_session cookie lands in the context jar,
 *  skipping the (slow, flaky) browser login flow entirely. */
async function login(ctx, who) {
  const res = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { email: `${LOGIN[who]}@parley.dev`, password: PASS },
    timeout: 120_000,
  });
  if (!res.ok()) throw new Error(`login ${who}: ${res.status()}`);
}

const box = async (page, sel) => {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  return el.boundingBox().catch(() => null);
};

const acts = {
  pause: (_p, s) => _p.waitForTimeout(s.ms),
  type: async (p, s) => {
    const el = p.locator(s.sel).last();
    await el.waitFor({ state: "attached", timeout: 30_000 });
    await el.evaluate((e) => e.focus());
    for (const ch of s.text) await p.keyboard.type(ch, { delay: 1000 / (s.rate ?? 60) });
  },
  press: (p, s) => p.keyboard.press(s.key),
  click: async (p, s) => {
    const b = await box(p, s.sel);
    if (b) await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 24 });
    await p.locator(s.sel).first().click().catch(() => {});
  },
  glideTo: async (p, s) => {
    const b = await box(p, s.sel);
    if (b) await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 40 });
    await p.waitForTimeout(700);
  },
  scrollTo: async (p, s) => {
    await p.evaluate((y) => scrollTo({ top: y, behavior: "smooth" }), s.y);
    await p.waitForTimeout(1200);
  },
  scrollBottom: async (p, s) => {
    await p.evaluate((sel) => {
      const el = document.querySelector(sel) ?? document.scrollingElement;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, s.sel);
    await p.waitForTimeout(1200);
  },
  scrollInto: async (p, s) => {
    await p.locator(s.sel).first().scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(800);
  },
  zoomTo: async (p, s) => {
    const b = await box(p, s.sel);
    const f = s.factor ?? 1.3;
    await p.evaluate(
      ({ b, f }) => {
        const x = b ? b.x + b.width / 2 : innerWidth / 2;
        const y = b ? b.y + b.height / 2 : innerHeight / 2;
        document.documentElement.style.cssText +=
          `;transform-origin:${x}px ${y}px;transition:transform .9s cubic-bezier(.25,.8,.3,1);` +
          `transform:scale(${f});`;
      },
      { b, f },
    );
    await p.waitForTimeout(1100);
  },
  zoomOut: async (p) => {
    await p.evaluate(() => {
      document.documentElement.style.transform = "scale(1)";
    });
    await p.waitForTimeout(1000);
  },
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });

for (const s of SCENES) {
  if (s.kind !== "take" || (only.length && !only.some((o) => s.id.startsWith(o)))) continue;
  const dir = path.join(OUT, `${s.id}-rec`);
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: { dir, size: { width: 1600, height: 900 } },
  });
  const page = await ctx.newPage();
  try {
    if (s.who !== "public") await login(ctx, s.who);
    await page.addInitScript(CURSOR_INIT);
    await page.goto(`${BASE}${s.route}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate(CURSOR_INIT);
    await page.waitForTimeout(1200);
    for (const step of s.steps) await acts[step.act]?.(page, step);
  } catch (e) {
    console.log(`✗ ${s.id}: ${e.message?.split("\n")[0]}`);
  }
  await ctx.close(); // flushing the webm happens on context close
  const v = page.video();
  if (v) {
    const p = await v.path().catch(() => null);
    if (p) console.log(`✓ ${s.id} → ${path.relative(process.cwd(), p)}`);
  }
}
writeFileSync(path.join(OUT, "README.txt"),
  "Each *-rec dir holds one webm take (unnamed until context close). Rename to the scene id before assembling.\n");
await browser.close();
console.log("done → video-build/takes/");
