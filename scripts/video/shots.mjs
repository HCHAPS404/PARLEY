/**
 * Camera choreography for every take. Each shot:
 *   as     — "buyer" | "seller" | null (public)
 *   space  — buyer space to activate before the shot (optional)
 *   url    — page to open *before* recording starts (omit = keep current page)
 *   run    — actions performed while recording; must last ≥ minDur (the
 *            producer calls take.holdUntil(minDur) afterwards anyway)
 * Recording only begins after the page has fully settled — no white frames.
 */
import { clickOn, glide, smoothScroll, zoomOut, zoomTo } from "./lib/recorder.mjs";

const SPACE = { personal: "17cf36da-6ceb-465d-890d-8ae8bf5bc272", bakery: "spc_b1_bakery" };

/** Wait for the buyer agent's stream to finish: no spinners and the
 *  transcript text stable for 3 s (or give up after `max` seconds). */
async function waitForAgent(page, max = 150) {
  let last = -1;
  let stable = 0;
  for (let i = 0; i < max; i++) {
    await page.waitForTimeout(1000);
    const busy = await page.locator(".animate-spin").count().catch(() => 0);
    const len = await page.evaluate(() => document.querySelector("main")?.innerText.length ?? 0).catch(() => 0);
    stable = len === last && busy === 0 ? stable + 1 : 0;
    last = len;
    if (i > 6 && stable >= 3) return true;
  }
  return false;
}

/** Scroll the chat so `locator` sits near the top of the viewport. */
async function bringToTop(page, locator, offset = 110, ms = 1300) {
  const b = await locator.boundingBox().catch(() => null);
  if (b) await smoothScroll(page, b.y - offset, ms);
}

async function typeHuman(page, text) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(26 + Math.random() * 34 + (ch === " " ? 30 : 0));
  }
}

export const SHOTS = {
  buyerAsk: {
    as: "buyer",
    space: SPACE.bakery,
    url: "/app",
    async run(page, take) {
      await page.mouse.move(980, 420);
      await page.waitForTimeout(500);
      const box = page.locator("textarea").last();
      await clickOn(page, box);
      await typeHuman(page, "Find kraft mailer boxes for my bakery launch and negotiate the best price.");
      await page.waitForTimeout(450);
      await page.keyboard.press("Enter");
      await page.mouse.move(1180, 300, { steps: 30 });
      await take.fast(() => waitForAgent(page), 6.5);
      // Guided tour of the answer: products → negotiations → verdict.
      const user = page.locator("main").getByText("Find kraft mailer boxes", { exact: false }).last();
      await bringToTop(page, user, 90, 1400);
      await page.waitForTimeout(1600);
      const neg = page.locator("main").getByText(/MERCHANT|merchant agent/i).first();
      await bringToTop(page, neg, 140, 1800);
      await page.waitForTimeout(2200);
      await smoothScroll(page, 99_999, 2200);
      await page.waitForTimeout(800);
      const table = page.locator("main table").last();
      if (await table.count()) {
        await zoomTo(page, table, 1.28, 1100);
        await page.waitForTimeout(2600);
        await zoomOut(page);
      }
    },
  },

  buyerOrder: {
    as: "buyer",
    async run(page, take) {
      const box = page.locator("textarea").last();
      await clickOn(page, box);
      await typeHuman(page, "Go with your recommendation and create the escrow order.");
      await page.waitForTimeout(400);
      await page.keyboard.press("Enter");
      await page.mouse.move(1180, 300, { steps: 30 });
      await take.fast(() => waitForAgent(page, 120), 4.5);
      await smoothScroll(page, 99_999, 1600);
      await page.waitForTimeout(700);
      const approve = page.locator("a:has-text('Approve on PayPal')").last();
      if (await approve.count()) {
        const card = approve.locator("xpath=ancestor::div[contains(@class,'rounded')][2]");
        await zoomTo(page, (await card.count()) ? card : approve, 1.35, 1200);
        await glide(page, approve, 50);
        await page.waitForTimeout(2600);
        await zoomOut(page);
      }
    },
  },

  pipeline: {
    as: "buyer",
    space: SPACE.bakery,
    url: "/pipeline",
    async run(page) {
      await page.mouse.move(760, 300);
      await page.waitForTimeout(900);
      const first = page.locator("article").first();
      await glide(page, first, 40);
      await page.waitForTimeout(1300);
      // Switch space: Bakery launch → Personal, live.
      const switcher = page.locator("button:has-text('Bakery launch')").first();
      await clickOn(page, switcher);
      await page.waitForTimeout(900);
      await clickOn(page, page.locator("button:has-text('Personal')").first());
      await page.waitForTimeout(2600);
      const released = page.locator("article", { hasText: "FoamLab" }).first();
      await glide(page, released, 45);
      await page.waitForTimeout(500);
      await released.click().catch(() => {});
      await page.waitForTimeout(1500);
      const rec = page.locator("a[href*='/receipt']").first();
      if (await rec.count()) {
        await zoomTo(page, rec, 1.22, 1000);
        await glide(page, rec, 40);
        await page.waitForTimeout(1400);
        await zoomOut(page, 700);
      }
    },
  },

  receipt: {
    as: "buyer",
    url: "/orders/SEED-FL-CAP/receipt",
    async run(page) {
      await page.mouse.move(1000, 260);
      await page.waitForTimeout(900);
      await zoomTo(page, page.getByText("Total held in escrow"), 1.25, 1300);
      await page.waitForTimeout(1300);
      await zoomOut(page, 800);
      await smoothScroll(page, 330, 1600);
      await page.waitForTimeout(600);
      await zoomTo(page, page.getByText("Escrow lifecycle"), 1.18, 1100);
      await page.waitForTimeout(1500);
      await zoomOut(page, 800);
      await smoothScroll(page, -330, 1200);
      await glide(page, page.locator("button:has-text('Print')").first(), 45);
    },
  },

  analytics: {
    as: "buyer",
    space: SPACE.personal,
    url: "/analytics",
    async run(page) {
      await page.mouse.move(900, 500);
      await page.waitForTimeout(800);
      const saved = page.getByText(/saved by negotiating/i).first();
      await zoomTo(page, saved, 1.3, 1200);
      await page.waitForTimeout(1600);
      await zoomOut(page, 800);
      await smoothScroll(page, 360, 1700);
      await page.waitForTimeout(900);
      await glide(page, page.getByText("PackRight Depot").first(), 45);
      await page.waitForTimeout(700);
      await smoothScroll(page, 520, 1900);
      await page.waitForTimeout(1200);
    },
  },

  approvals: {
    as: "buyer",
    space: SPACE.personal,
    url: "/inbox",
    async run(page) {
      await page.mouse.move(900, 600);
      await page.waitForTimeout(700);
      const offer = page.getByText("PackRight Depot sent you an offer").first();
      await zoomTo(page, offer, 1.3, 1200);
      await glide(page, page.locator("button:has-text('Accept offer')").first(), 45);
      await page.waitForTimeout(1900);
      await zoomOut(page, 800);
    },
  },

  sellerHome: {
    as: "seller",
    url: "/seller",
    async run(page) {
      await page.mouse.move(1000, 420);
      await page.waitForTimeout(800);
      const kpi = page.getByText(/Revenue negotiated/i).first();
      await zoomTo(page, kpi, 1.22, 1200);
      await page.waitForTimeout(1100);
      await zoomOut(page, 800);
      const funnel = page.getByText(/negotiation funnel/i).first();
      await glide(page, funnel, 40);
      await zoomTo(page, funnel, 1.18, 1000);
      await page.waitForTimeout(1600);
      await zoomOut(page, 800);
    },
  },

  sellerCopilot: {
    as: "seller",
    url: "/seller/copilot",
    async run(page, take) {
      await page.mouse.move(900, 500);
      await page.waitForTimeout(600);
      await clickOn(page, page.locator("button:has-text('How is my store doing?')").first());
      await page.mouse.move(1250, 330, { steps: 30 });
      await take.fast(() => waitForAgent(page, 90), 3.5);
      await page.waitForTimeout(900);
      await smoothScroll(page, 99_999, 1500);
      await page.waitForTimeout(1500);
    },
  },

  inventory: {
    as: "seller",
    url: "/seller/inventory",
    async run(page) {
      await page.mouse.move(900, 420);
      await page.waitForTimeout(900);
      const edit = page.locator("button:has-text('Edit')").first();
      await clickOn(page, edit);
      await page.waitForTimeout(1100);
      const desc = page.locator("textarea").first();
      await glide(page, desc, 40);
      await zoomTo(page, desc, 1.15, 1000);
      await page.waitForTimeout(1500);
      await zoomOut(page, 700);
    },
  },

  sellerThread: {
    as: "seller",
    url: "/messages",
    async run(page) {
      await page.mouse.move(700, 400);
      await page.waitForTimeout(600);
      const ken = page.locator("li button", { hasText: "ken" }).first();
      await clickOn(page, (await ken.count()) ? ken : page.locator("li button").first());
      await page.waitForTimeout(1800);
      const photo = page.locator("main img").last();
      if (await photo.count()) {
        await zoomTo(page, photo, 1.3, 1200);
        await page.waitForTimeout(1800);
        await zoomOut(page, 800);
      }
      await glide(page, page.getByText(/Sending a replacement/i).first(), 45);
      await page.waitForTimeout(900);
    },
  },

  storefront: {
    as: null,
    url: "/s/parcelpro-supply",
    async run(page) {
      await page.mouse.move(1300, 230);
      await page.waitForTimeout(900);
      await zoomTo(page, page.getByText(/vendor score/i).first(), 1.3, 1200);
      await page.waitForTimeout(1200);
      await zoomOut(page, 800);
      await smoothScroll(page, 480, 2000);
      await glide(page, page.getByText(/win-back|−10%|-10%/i).first(), 45);
      await page.waitForTimeout(1000);
      await smoothScroll(page, 700, 2200);
      await page.waitForTimeout(1000);
    },
  },
};
