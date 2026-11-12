/**
 * Generates catalog photos for the staged demo products via Meta muse-image-1.0.
 * Usage: npx tsx scripts/gen-product-photos.mts
 * Reads META_BASE_URL/META_API_KEY from .env.local. Output: public/products/*.webp
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const STYLE =
  "e-commerce product photography on a dark charcoal studio background, soft key light with a subtle teal rim light, centered composition, crisp detail, photorealistic, no text, no words, no letters, no watermark";

const PRODUCTS: Record<string, string> = {
  "kraft-mailer-box":
    `a neat stack of small brown kraft cardboard mailer boxes, corrugated edge visible, clean e-commerce shot, ${STYLE}`,
  "poly-bubble-mailer":
    `a small fanned stack of white poly bubble mailer envelopes with a matte texture and self-seal strip, ${STYLE}`,
  "packing-tape":
    `six rolls of clear reinforced packing tape standing in a row, one roll tilted forward showing the glossy tape surface and cardboard core, ${STYLE}`,
  "insulated-box-liner":
    `a folded insulated shipping box liner made of silver metallic foil bubble insulation, slightly open showing the padded interior, ${STYLE}`,
};

async function env(name: string) {
  const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return (m?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const base = await env("META_BASE_URL");
const key = await env("META_API_KEY");
if (!base || !key) throw new Error("META_BASE_URL/META_API_KEY missing");

const out = path.join(process.cwd(), "public", "products");
await mkdir(out, { recursive: true });

for (const [name, prompt] of Object.entries(PRODUCTS)) {
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
console.log("done → public/products/");
