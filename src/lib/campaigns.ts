/**
 * Seller campaigns — time-boxed % promotions a merchant runs on a product or
 * the whole catalog. A campaign is the seller explicitly lowering their own
 * price, so it becomes the agent's advertised price AND its effective floor:
 * the agent may sell at the promo (or above) but never below it.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { sellerCampaigns, sellerProducts } from "./db/schema";

export interface ActiveCampaign {
  id: string;
  name: string;
  pctOff: number;
}

type Row = ActiveCampaign & { productId: string | null; endsAt: Date | null };

async function liveCampaigns(sellerUserId: string): Promise<Row[]> {
  const rows = await getDb()
    .select({
      id: sellerCampaigns.id,
      name: sellerCampaigns.name,
      pctOff: sellerCampaigns.pctOff,
      productId: sellerCampaigns.productId,
      endsAt: sellerCampaigns.endsAt,
    })
    .from(sellerCampaigns)
    .where(and(eq(sellerCampaigns.userId, sellerUserId), eq(sellerCampaigns.active, true)))
    .limit(100);
  const now = Date.now();
  return rows.filter((r) => r.endsAt == null || r.endsAt.getTime() > now);
}

/** Deepest active, in-window campaign for a product (product-specific beats global). */
export async function activeCampaignFor(
  sellerUserId: string,
  productId: string,
): Promise<ActiveCampaign | null> {
  let best: ActiveCampaign | null = null;
  for (const c of await liveCampaigns(sellerUserId)) {
    if (c.productId != null && c.productId !== productId) continue;
    if (!best || c.pctOff > best.pctOff) best = c;
  }
  return best;
}

export const promoPriceCents = (listCents: number, pctOff: number) =>
  Math.max(1, Math.round((listCents * (100 - pctOff)) / 100));

/** Campaign map for a whole catalog — used to advertise promo prices in search. */
export async function activeCampaignsMap(
  sellerUserId: string,
): Promise<{ global: ActiveCampaign | null; byProduct: Map<string, ActiveCampaign> }> {
  const byProduct = new Map<string, ActiveCampaign>();
  let global: ActiveCampaign | null = null;
  for (const c of await liveCampaigns(sellerUserId)) {
    if (c.productId == null) {
      if (!global || c.pctOff > global.pctOff) global = c;
    } else {
      const prev = byProduct.get(c.productId);
      if (!prev || c.pctOff > prev.pctOff) byProduct.set(c.productId, c);
    }
  }
  return { global, byProduct };
}

/** The merchant's authoritative catalog entry — its own price, not the caller's. */
export async function ownedProduct(sellerUserId: string, productId: string) {
  const [p] = await getDb()
    .select()
    .from(sellerProducts)
    .where(and(eq(sellerProducts.id, productId), eq(sellerProducts.userId, sellerUserId)))
    .limit(1);
  return p ?? null;
}
