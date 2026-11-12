import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { pricePoints } from "./db/schema";

/** Writes one point on the price trace. Never throws — the trace is
 *  observability, not a gate. */
export async function recordPricePoint(p: {
  userId: string;
  spaceId?: string | null;
  vendorDomain?: string | null;
  sellerUserId?: string | null;
  title: string;
  cents: number;
  kind: "list" | "paid";
  orderId?: string | null;
}) {
  try {
    await getDb().insert(pricePoints).values({
      id: `pp_${randomUUID()}`,
      userId: p.userId,
      spaceId: p.spaceId ?? null,
      vendorDomain: p.vendorDomain ?? null,
      sellerUserId: p.sellerUserId ?? null,
      title: p.title,
      cents: p.cents,
      kind: p.kind,
      orderId: p.orderId ?? null,
    });
  } catch {
    // trace write must never break the order path
  }
}
