/**
 * Pure predicates for the relationship-layer invariants — the rules the
 * routes enforce, isolated so the test suite can pin them down.
 */

/** Escrow lifecycle states where the money is still held — a claim only
 * makes sense while there's money to protect. */
const OPEN_ESCROW = new Set(["created", "approved", "authorized", "shipped", "delivered"]);

/** Buyer may open a claim: escrow open, not already disputed, not finished. */
export function canReportOrder(status: string, disputedAt: Date | string | null | undefined) {
  return OPEN_ESCROW.has(status) && !disputedAt;
}

/** Buyer may review: only after the money moved or goods confirmed. */
export function canReviewOrder(status: string) {
  return status === "captured" || status === "delivered";
}

/** Escrow states where money is actually held — the buyer can only confirm
 * receipt of something they've paid for. */
const FUNDED_ESCROW = new Set(["authorized", "shipped"]);

/** Only the buyer (or the carrier feed) can mark delivered — only once the
 * funds are actually held, and never while a claim is open: confirming
 * receipt of an order you reported as broken is a contradiction. */
export function canConfirmReceipt(
  status: string,
  deliveredAt: Date | string | null | undefined,
  disputedAt?: Date | string | null,
) {
  return FUNDED_ESCROW.has(status) && !deliveredAt && !disputedAt;
}

/** A direct offer's hard floor — the same margin invariant the agent obeys. */
export function offerFloorCents(listCents: number, floorRatioPct: number) {
  return Math.round((listCents * floorRatioPct) / 100);
}

/** Offer price must clear the floor — sellers cannot undercut their own margin. */
export function canSendOffer(priceCents: number, listCents: number, floorRatioPct: number) {
  return Number.isInteger(priceCents) && priceCents >= offerFloorCents(listCents, floorRatioPct);
}
