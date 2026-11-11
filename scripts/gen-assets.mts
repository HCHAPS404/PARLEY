/**
 * Generates the brand illustration set via Meta muse-image-1.0.
 * Usage: npx tsx scripts/gen-assets.mts [only-these-names...]
 * Reads META_BASE_URL/META_API_KEY from .env.local. Output: public/gen/*.webp
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const STYLE =
  "flat vector editorial illustration, minimal geometric shapes, warm off-white paper background #fafaf8, single teal accent color #0f766e with soft tints, dark ink #17150f linework, clean modern SaaS product illustration style, generous negative space, no text, no words, no letters, no watermark";

const ASSETS: Record<string, string> = {
  "hero-user":
    `a young woman freelancer sitting cross-legged on a bean bag with a laptop on her lap, floating chat bubbles and a product card UI panel around her, shopping bag and box icons, relaxed confident pose, ${STYLE}`,
  "agents-meet":
    `two abstract robot speech bubbles facing each other shaking hands across a product box between them, one bubble larger solid teal, other smaller outlined, sparkles around handshake, ${STYLE}`,
  "escrow-vault":
    `an open bank vault door revealing coins and a shield with checkmark inside, a package box next to it, ${STYLE}`,
  "market-radar":
    `a circular radar screen with concentric rings and a sweeping beam, small product icons plotted on it, a rising line chart behind, ${STYLE}`,
  "seller-sleep":
    `a small merchant storefront awning at night with moon and stars, a friendly robot bubble inside the shop serving customers through the window, cozy and calm, ${STYLE}`,
  "empty-inbox":
    `an open empty inbox tray with a single green checkmark floating above it, soft and airy, ${STYLE}`,
  "empty-catalog":
    `an empty open cardboard box with a price tag floating above it, question mark free, soft and airy, ${STYLE}`,
  "dashboard-deco":
    `abstract composition of floating UI cards, bar charts, coins and a magnifying glass arranged in an arc, ${STYLE}`,
  "negotiation-loop":
    `two hands exchanging a price tag between speech bubbles, circular arrows around them suggesting back-and-forth rounds, ${STYLE}`,
};

const only = process.argv.slice(2);

async function env(name: string) {
  const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return (m?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const base = await env("META_BASE_URL");
const key = await env("META_API_KEY");
if (!base || !key) throw new Error("META_BASE_URL/META_API_KEY missing");

const out = path.join(process.cwd(), "public", "gen");
await mkdir(out, { recursive: true });

for (const [name, prompt] of Object.entries(ASSETS)) {
  if (only.length && !only.includes(name)) continue;
  const file = path.join(out, `${name}.webp`);
  process.stdout.write(`→ ${name} … `);
  const r = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "muse-image-1.0", prompt, n: 1 }),
  });
  const j = (await r.json().catch(() => ({}))) as {
    data?: { b64_json?: string }[];
    error?: { message?: string };
  };
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) {
    console.log(`FAIL ${j.error?.message ?? "no image"}`);
    continue;
  }
  await writeFile(file, Buffer.from(b64, "base64"));
  console.log("ok");
}
console.log("done → public/gen/");
