/**
 * Generates the brand illustration set via Meta muse-image-1.0.
 * Usage: npx tsx scripts/gen-assets.mts [only-these-names...]
 * Reads META_BASE_URL/META_API_KEY from .env.local. Output: public/gen/*.webp
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const STYLE =
  "professional editorial photograph for a high-end SaaS landing page, real people, natural window light, shallow depth of field, warm neutral tones with subtle teal accents, clean minimal composition, shot on a full-frame camera, soft film grain, no text, no words, no letters, no watermark, photorealistic";

const ASSETS: Record<string, string> = {
  "hero-user":
    `a young Latina freelancer sitting comfortably on a sofa in a bright modern apartment working on a laptop, a stack of delivery parcels and a coffee cup beside her, relaxed confident expression, warm afternoon light through a large window, ${STYLE}`,
  "agents-meet":
    `two professionals shaking hands across a clean minimal desk, two laptops facing each other each showing a chat conversation, soft office daylight, hands and laptops in focus, ${STYLE}`,
  "escrow-vault":
    `a heavy round steel bank vault door slightly ajar revealing neatly stacked parcels and a small glowing shield emblem inside, dramatic rim lighting in a dim room, concept of money held safely until delivery, ${STYLE}`,
  "market-radar":
    `a focused professional at dusk in a modern office analyzing a large monitor glowing with price charts and a circular radar visualization, screen light on their face, city lights blurred behind, ${STYLE}`,
  "seller-sleep":
    `a cozy small boutique after closing at night, warm desk lamp glowing on the counter next to an open laptop showing a sales dashboard, the shop owner sleeping peacefully in a chair behind the counter wrapped in a blanket, moonlight through the storefront window, ${STYLE}`,
  "empty-inbox":
    `a tidy minimal desk in soft morning light with a closed laptop, a small potted plant and an empty coffee mug, everything finished and organized, calm and airy, ${STYLE}`,
  "empty-catalog":
    `bright empty white shelves in a small modern boutique waiting to be stocked, a few folded cardboard boxes on the floor, clean retail interior in soft daylight, ${STYLE}`,
  "dashboard-deco":
    `overhead flat-lay of a clean workspace: laptop showing an analytics dashboard, notebook, pen, coffee and a small parcel on a light wooden desk, soft daylight, ${STYLE}`,
  "negotiation-loop":
    `close-up of two hands exchanging a small parcel across a table, one hand offering cash, soft studio light, blurred laptops in the background showing price charts, ${STYLE}`,
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
