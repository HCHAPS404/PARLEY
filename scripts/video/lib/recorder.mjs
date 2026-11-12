/**
 * High-fidelity take recorder built on CDP Page.startScreencast.
 *
 * Why not Playwright's recordVideo: it encodes VP9 at a fixed ~1 Mbps/25 fps
 * and starts recording before the page paints (white frames). Here we stream
 * compositor frames as JPEG q≈92 at device resolution, only once the page is
 * ready, keep the real timestamp of every frame, and can fast-forward any
 * interval (e.g. while the LLM thinks) by rescaling those timestamps.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const VIEW = { width: 1440, height: 810, dpr: 4 / 3 }; // → 1920×1080 frames

/** Visible cursor: teal dot + click ripple, follows real CDP mouse events. */
export const CURSOR_INIT = () => {
  if (document.getElementById("__cur")) return;
  const mk = () => {
    const c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText =
      "position:fixed;left:-60px;top:-60px;width:20px;height:20px;border-radius:50%;" +
      "background:rgba(13,148,136,.92);border:2px solid #fff;" +
      "box-shadow:0 2px 10px rgba(0,0,0,.25),0 0 0 6px rgba(45,212,191,.18);" +
      "pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%);" +
      "transition:transform .12s ease-out";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", (e) => {
      c.style.transform = "translate(-50%,-50%) scale(.75)";
      const r = document.createElement("div");
      r.style.cssText =
        `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:16px;height:16px;border-radius:50%;` +
        "border:2px solid rgba(13,148,136,.8);transform:translate(-50%,-50%);pointer-events:none;" +
        "z-index:2147483646;transition:all .55s ease-out;opacity:1";
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.width = r.style.height = "70px"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
    addEventListener("mouseup", () => { c.style.transform = "translate(-50%,-50%) scale(1)"; }, true);
  };
  if (document.body) mk(); else addEventListener("DOMContentLoaded", mk);
};

/** Fast-forward badge shown while a sped-up interval plays. */
const BADGE = (on) => {
  let b = document.getElementById("__ff");
  if (!on) return b?.remove();
  if (b) return;
  b = document.createElement("div");
  b.id = "__ff";
  b.textContent = "⏩  agent working — sped up";
  b.style.cssText =
    "position:fixed;right:22px;top:18px;z-index:2147483647;padding:6px 12px;border-radius:999px;" +
    "background:rgba(15,23,22,.82);color:#5eead4;font:600 12px system-ui;letter-spacing:.02em;" +
    "box-shadow:0 4px 14px rgba(0,0,0,.2)";
  document.documentElement.appendChild(b);
};

export class Take {
  constructor(page, dir) {
    this.page = page;
    this.dir = dir;
    this.frames = [];
    this.ff = []; // [{from,to,factor}]
  }

  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    let n = 0;
    this.cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      const f = path.join(this.dir, `f${String(n++).padStart(6, "0")}.jpg`);
      writeFileSync(f, Buffer.from(data, "base64"));
      this.frames.push({ f, t: metadata.timestamp });
      this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1,
    });
    this.t0 = Date.now() / 1000;
    // nudge one paint so the first frame exists immediately
    await this.page.evaluate(() => { document.documentElement.style.outline = "0 solid transparent"; });
  }

  now() { return Date.now() / 1000; }

  /** Run fn with the interval sped up in the final cut. `target` = how many
   *  seconds the interval should last on screen, whatever it took live. */
  async fast(fn, target = 6) {
    await this.page.evaluate(BADGE, true).catch(() => {});
    const from = this.now();
    try { await fn(); } finally {
      const to = this.now();
      const factor = Math.max(1, (to - from) / target);
      this.ff.push({ from, to, factor });
      await this.page.evaluate(BADGE, false).catch(() => {});
    }
  }

  /** Hold until the take has lasted at least `sec` seconds of *output* time. */
  async holdUntil(sec) {
    const left = sec - this.outputDuration(this.now());
    if (left > 0) await this.page.waitForTimeout(left * 1000);
  }

  outputDuration(until) {
    let d = until - this.t0;
    for (const r of this.ff) d -= (Math.min(r.to, until) - r.from) * (1 - 1 / r.factor);
    return d;
  }

  /** Map wall-clock time to output time. */
  out(t) { return this.outputDuration(t); }

  async stop() {
    const t1 = this.now();
    await this.cdp.send("Page.stopScreencast").catch(() => {});
    await new Promise((r) => setTimeout(r, 250));
    const fr = this.frames.filter((x) => x.t <= t1 + 0.05);
    if (!fr.length) throw new Error(`no frames in ${this.dir}`);
    let list = "ffconcat version 1.0\n";
    for (let i = 0; i < fr.length; i++) {
      const a = i === 0 ? 0 : this.out(fr[i].t);
      const b = i + 1 < fr.length ? this.out(fr[i + 1].t) : this.out(t1);
      const d = Math.max(0.001, b - a);
      list += `file '${path.basename(fr[i].f)}'\nduration ${d.toFixed(4)}\n`;
    }
    list += `file '${path.basename(fr[fr.length - 1].f)}'\n`;
    writeFileSync(path.join(this.dir, "frames.ffconcat"), list);
    return { dir: this.dir, duration: this.out(t1), frames: fr.length };
  }
}

/** Largest scrollable element (the app scrolls inside <main>, not window). */
export async function smoothScroll(page, by, ms = 1400) {
  await page.evaluate(
    async ({ by, ms }) => {
      const els = [...document.querySelectorAll("*")].filter((e) => {
        const s = getComputedStyle(e);
        return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 20;
      });
      const el = els.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0]
        ?? document.scrollingElement;
      const start = el.scrollTop;
      const t0 = performance.now();
      await new Promise((res) => {
        const step = (t) => {
          const k = Math.min(1, (t - t0) / ms);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          el.scrollTop = start + by * e;
          k < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      });
    },
    { by, ms },
  );
}

/** Camera push-in on an element (CSS transform on <html>, eased). */
export async function zoomTo(page, locator, factor = 1.4, ms = 1100) {
  const b = await locator.boundingBox().catch(() => null);
  await page.evaluate(
    ({ b, f, ms }) => {
      const x = b ? b.x + b.width / 2 : innerWidth / 2;
      const y = b ? b.y + b.height / 2 : innerHeight / 2;
      const h = document.documentElement;
      h.style.transition = `transform ${ms}ms cubic-bezier(.22,.8,.26,1)`;
      h.style.transformOrigin = `${x}px ${y}px`;
      h.style.transform = `scale(${f})`;
    },
    { b, f: factor, ms },
  );
  await page.waitForTimeout(ms + 100);
}

export async function zoomOut(page, ms = 900) {
  await page.evaluate((ms) => {
    const h = document.documentElement;
    h.style.transition = `transform ${ms}ms cubic-bezier(.22,.8,.26,1)`;
    h.style.transform = "scale(1)";
  }, ms);
  await page.waitForTimeout(ms + 100);
}

/** Natural mouse glide (eased, many steps) to an element's center. */
export async function glide(page, locator, steps = 45) {
  const b = await locator.boundingBox().catch(() => null);
  if (!b) return false;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps });
  await page.waitForTimeout(250);
  return true;
}

export async function clickOn(page, locator) {
  await glide(page, locator);
  await page.waitForTimeout(150);
  await locator.click({ timeout: 10_000 }).catch(() => {});
}

/** Wait for the network + fonts + images, so recording never starts on white. */
export async function settle(page, extra = 900) {
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.evaluate(() =>
    Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
  ).catch(() => {});
  await page.waitForTimeout(extra);
}
