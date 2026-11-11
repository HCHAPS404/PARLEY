/**
 * Generates the brand illustration set via Meta muse-image-1.0.
 * Usage: npx tsx scripts/gen-assets.mts [only-these-names...]
 * Reads META_BASE_URL/META_API_KEY from .env.local. Output: public/gen/*.webp
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const STYLE =
  "cinematic studio product photography on a pure black background, single subject emerging from darkness with a soft teal rim light tracing its edges, deep shadows, minimal composition, high-end tech keynote aesthetic, photorealistic, no text, no words, no letters, no watermark";

const ASSETS: Record<string, string> = {
  "hero-user":
    `over-the-shoulder view of a freelancer in a dark studio lit only by the glow of a laptop screen showing a dark procurement dashboard with chat bubbles and price cards, parcels stacked softly out of focus behind, ${STYLE}`,
  "agents-meet":
    `two premium laptops on a dark reflective table facing each other, each screen glowing with a live negotiation chat of offer bubbles, a small parcel centered between them catching the light, ${STYLE}`,
  "escrow-vault":
    `a heavy round brushed-steel bank vault door slightly ajar on a black background, neatly stacked parcels and a small glowing shield emblem visible inside the opening, ${STYLE}`,
  "market-radar":
    `a large professional monitor on a black desk in a dark studio glowing with a market analytics dashboard: circular radar visualization, rising price curves and product thumbnails, screen light spilling onto the desk, ${STYLE}`,
  "seller-sleep":
    `a cozy small boutique after closing at night, warm desk lamp glowing on the counter next to an open laptop showing a sales dashboard, the shop owner sleeping peacefully in a chair behind the counter wrapped in a blanket, moonlight through the storefront window, cinematic night photography, photorealistic, no text, no watermark`,
  "empty-inbox":
    `a tidy minimal desk in soft morning light with a closed laptop, a small potted plant and an empty coffee mug, everything finished and organized, calm and airy, editorial photo, photorealistic, no text, no watermark`,
  "empty-catalog":
    `bright empty white shelves in a small modern boutique waiting to be stocked, a few folded cardboard boxes on the floor, clean retail interior in soft daylight, editorial photo, photorealistic, no text, no watermark`,
  "dashboard-deco":
    `overhead flat-lay on a dark matte desk: a laptop showing a glowing analytics dashboard, a small parcel, a notebook and keys arranged with precision, single soft overhead light, ${STYLE}`,
  "negotiation-loop":
    `two smartphones lying on a dark reflective table facing each other, screens showing a live price negotiation chat with offer bubbles, a small sealed parcel between them, ${STYLE}`,
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
