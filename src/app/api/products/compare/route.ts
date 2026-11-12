import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { ensureDb, getDb } from "@/lib/db";
import { merchantProfiles, sellerProducts } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { activeCampaignsMap, promoPriceCents } from "@/lib/campaigns";
import { slugify } from "@/lib/slug";

export const maxDuration = 30;

const STOP = new Set([
  "the", "a", "an", "of", "for", "and", "with", "in", "on", "pack",
]);

/** Which Parley sellers carry something like this product? Powers the
 *  compare panel: web offers (from the search card) vs agent-negotiable
 *  sellers inside the platform. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const title = new URL(req.url).searchParams.get("title")?.trim() ?? "";
  if (!title) return NextResponse.json({ sellers: [] });
  await ensureDb();
  const db = getDb();

  // Match on the product's meaningful words — "kraft mailer box 12x9x4" hits
  // any seller product sharing two content words.
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 4);
  const rows = words.length
    ? await db
        .select({
          id: sellerProducts.id,
          title: sellerProducts.title,
          priceCents: sellerProducts.priceCents,
          image: sellerProducts.image,
          stock: sellerProducts.stock,
          sellerUserId: sellerProducts.userId,
          sellerName: merchantProfiles.displayName,
        })
        .from(sellerProducts)
        .innerJoin(merchantProfiles, eq(merchantProfiles.userId, sellerProducts.userId))
        .where(
          sql`(${sql.join(
            words.map((w) => sql`${sellerProducts.title} ilike ${"%" + w + "%"}`),
            sql` or `,
          )})`,
        )
        .limit(12)
    : [];

  // Rank by shared-word count; price reflects each seller's live campaign.
  const seen = new Set<string>();
  const sellers = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const shared = words.filter((w) => r.title.toLowerCase().includes(w)).length;
    const { byProduct, global: g } = await activeCampaignsMap(r.sellerUserId);
    const camp = byProduct.get(r.id) ?? g;
    sellers.push({
      id: r.id,
      title: r.title,
      image: r.image,
      stock: r.stock,
      listCents: r.priceCents,
      priceCents: camp ? promoPriceCents(r.priceCents, camp.pctOff) : r.priceCents,
      promo: camp ? `−${camp.pctOff}%` : null,
      sellerName: r.sellerName,
      storefront: `/s/${slugify(r.sellerName)}`,
      negotiable: true,
      shared,
    });
  }
  sellers.sort((a, b) => b.shared - a.shared || a.priceCents - b.priceCents);
  return NextResponse.json({ sellers: sellers.slice(0, 6) });
}
