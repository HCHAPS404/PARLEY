import { Channel3 } from "@channel3/sdk";
import { env } from "./env";

let client: Channel3 | null = null;

export function channel3(): Channel3 {
  if (!client) client = new Channel3({ apiKey: env.channel3ApiKey });
  return client;
}

export interface OfferInfo {
  domain: string;
  priceCents: number;
  currency: string;
  url: string;
}

/** Normalized product card — the only product shape the agent and UI ever see. */
export interface ProductCard {
  id: string;
  title: string;
  brand?: string;
  image?: string;
  bestPriceCents: number | null;
  currency: string;
  merchant?: string;
  buyUrl?: string;
  offersCount: number;
  offers: OfferInfo[];
}

interface RawOffer {
  url?: string;
  domain?: string;
  price?: { price?: number; currency?: string; compare_at_price?: number | null };
}

interface RawProduct {
  id?: string;
  title?: string;
  name?: string;
  brand?: string | { name?: string };
  image?: string;
  image_url?: string;
  images?: { url?: string; is_main_image?: boolean }[];
  offers?: RawOffer[];
}

function toCents(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function normalize(p: RawProduct): ProductCard {
  const offers: OfferInfo[] = (p.offers ?? [])
    .map((o) => ({
      domain: o.domain ?? (o.url ? new URL(o.url).hostname : "unknown"),
      priceCents: toCents(o.price?.price) ?? 0,
      currency: o.price?.currency ?? "USD",
      url: o.url ?? "",
    }))
    .filter((o) => o.priceCents > 0)
    .sort((a, b) => a.priceCents - b.priceCents);

  const best = offers[0];
  return {
    id: String(p.id ?? ""),
    title: p.title ?? p.name ?? "Untitled product",
    brand: typeof p.brand === "string" ? p.brand : p.brand?.name,
    image:
      p.image ??
      p.image_url ??
      p.images?.find((i) => i.is_main_image)?.url ??
      p.images?.[0]?.url,
    bestPriceCents: best?.priceCents ?? null,
    currency: best?.currency ?? "USD",
    merchant: best?.domain,
    buyUrl: best?.url,
    offersCount: offers.length,
    offers: offers.slice(0, 5),
  };
}

export async function searchProducts(input: {
  query?: string;
  imageUrl?: string;
  base64Image?: string;
  maxPriceCents?: number;
  limit?: number;
}): Promise<{ products: ProductCard[]; error?: string }> {
  if (!env.channel3ApiKey) return { products: [], error: "CHANNEL3_API_KEY not set" };
  try {
    const page = await channel3().products.search({
      query: input.query ?? null,
      image_url: input.imageUrl ?? null,
      base64_image: input.base64Image ?? null,
      limit: Math.min(input.limit ?? 10, 30),
      filters:
        input.maxPriceCents != null
          ? { price: { max_price: input.maxPriceCents / 100 } }
          : undefined,
    });
    const raw = ((page as { data?: RawProduct[] }).data ?? []) as RawProduct[];
    let products = raw.map(normalize).filter((p) => p.id);
    if (input.maxPriceCents != null) {
      products = products.filter(
        (p) => p.bestPriceCents == null || p.bestPriceCents <= input.maxPriceCents!,
      );
    }
    return { products };
  } catch (e) {
    return { products: [], error: e instanceof Error ? e.message : "Channel3 error" };
  }
}
