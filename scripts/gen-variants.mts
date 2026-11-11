/**
 * Generates 3 candidate shots per landing asset via muse-image-1.0.
 * Usage: npx tsx scripts/gen-variants.mts [names...]
 * Output: .variants/<name>-{a,b,c}.webp — pick winners manually.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const STYLE =
  "high-end editorial product photography on matte black, dramatic restrained lighting, soft teal accent rim light, shot on medium-format camera, tack sharp, single hero subject, generous negative space, Apple keynote / Dezeen product-launch aesthetic, photorealistic, no text, no words, no letters, no watermark";

const ASSETS: Record<string, string> = {
  "hero-user":
    `over-the-shoulder cinematic shot of a professional working at a laptop in a dark studio, screen glowing with a minimal dark dashboard of chat bubbles and price charts, cardboard parcels softly blurred in the black background, teal screen-glow rim light on their silhouette, ${STYLE}`,
  "agents-meet":
    `two premium laptops facing each other on a dark reflective table, screens glowing with a live negotiation chat of offer bubbles, a small wrapped parcel centered between them, single overhead key light, ${STYLE}`,
  "escrow-vault":
    `a massive brushed-steel bank vault door ajar on pure black, parcels neatly stacked inside the opening, soft volumetric teal light spilling through the gap, ${STYLE}`,
  "market-radar":
    `a large studio monitor on a black desk glowing with a minimal market-intelligence dashboard — a circular radar, rising price curves and product thumbnails — teal screen glow spilling onto the desk, ${STYLE}`,
  "dashboard-deco":
    `overhead flat-lay on a dark matte desk: a laptop showing a glowing dark analytics dashboard, a small parcel, a slim notebook and keys arranged with Swiss precision, single soft overhead light, ${STYLE}`,
  "negotiation-loop":
    `two smartphones lying face-up on a dark reflective table angled toward each other, screens showing a live price-negotiation chat, a sealed parcel between them, dramatic single spotlight, ${STYLE}`,
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

const out = path.join(process.cwd(), ".variants");
await mkdir(out, { recursive: true });

for (const [name, prompt] of Object.entries(ASSETS)) {
  if (only.length && !only.includes(name)) continue;
  for (const v of ["a", "b", "c"]) {
    const file = path.join(out, `${name}-${v}.webp`);
    process.stdout.write(`→ ${name}-${v} … `);
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
}
console.log("done → .variants/");
