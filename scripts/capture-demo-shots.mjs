/**
 * Captures the demo-guide screenshots against the live prod deployment
 * (the staged judge data lives in prod Neon — local PGlite wouldn't show it).
 *
 *   node scripts/capture-demo-shots.mjs
 *
 * Output: public/demo/*.jpg (loaded by /demo — the "how to use" page).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.DEMO_BASE ?? "https://parley-wt1k.onrender.com";
const PASS = "ParleyJudgeDemo26";
const OUT = fileURLToPath(new URL("../public/demo/", import.meta.url));

// Login identifiers — emails work on the currently deployed build; once the
// username-login change ships, "buyer1"/"seller1" work too.
const buyer = "buyer@parley.dev";
const seller = "seller@parley.dev";

const shots = [
  // [file, url, role, waitNote]
  ["buyer-chat", "/app", buyer],
  ["buyer-pipeline", "/pipeline", buyer],
  ["buyer-inbox", "/inbox", buyer],
  ["buyer-messages", "/messages", buyer],
  ["buyer-sellers", "/sellers", buyer],
  ["seller-home", "/seller", seller],
  ["seller-orders", "/seller/orders", seller],
  ["seller-customers", "/seller/customers", seller],
  ["seller-copilot", "/seller/copilot", seller],
  ["seller-messages", "/messages", seller],
  ["storefront", "/s/parcelpro-supply", null],
  ["landing", "/", null],
];

async function login(page, user) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  // First hit may be a Render cold start — be generous.
  await page.waitForSelector('input[type="text"], input[type="email"]', { timeout: 120_000 });
  await page.fill('input[autocomplete="username"], input[type="email"], input[type="text"]', user);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(app|seller)/, { timeout: 120_000 });
}

// Uses the locally installed Edge — no bundled-chromium download needed.
const browser = await chromium.launch({ channel: "msedge" });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await ctx.newPage();
mkdirSync(OUT, { recursive: true });

let loggedInAs = null;
for (const [file, url, role] of shots) {
  try {
    if (role && loggedInAs !== role) {
      await ctx.clearCookies();
      await login(page, role);
      loggedInAs = role;
    }
    if (!role && loggedInAs) {
      await ctx.clearCookies();
      loggedInAs = null;
    }
    await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    // Let client data fetch + first paint settle.
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${OUT}${file}.jpg`, type: "jpeg", quality: 82 });
    console.log(`✓ ${file}`);
  } catch (e) {
    console.log(`✗ ${file}: ${e.message.split("\n")[0]}`);
  }
}
await browser.close();
