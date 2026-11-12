import { describe, expect, it } from "vitest";
import {
  canConfirmReceipt,
  canReportOrder,
  canReviewOrder,
  canSendOffer,
  offerFloorCents,
} from "../claims";

// The relationship layer's invariants — same rigor as the money rules.

describe("offer floor — the margin invariant holds outside the agent too", () => {
  it("floor is exactly list × ratio, rounded", () => {
    expect(offerFloorCents(4200, 85)).toBe(3570);
    expect(offerFloorCents(1000, 50)).toBe(500);
  });

  it("accepts at the floor, rejects a cent below", () => {
    expect(canSendOffer(3570, 4200, 85)).toBe(true);
    expect(canSendOffer(3569, 4200, 85)).toBe(false);
  });

  it("rejects non-integer and zero prices", () => {
    expect(canSendOffer(0, 4200, 85)).toBe(false);
    expect(canSendOffer(35.5, 4200, 85)).toBe(false);
  });
});

describe("claims — only while the money is held", () => {
  it("open escrow states can be claimed once", () => {
    for (const s of ["created", "approved", "authorized", "shipped", "delivered"]) {
      expect(canReportOrder(s, null)).toBe(true);
    }
  });

  it("finished or dead escrows cannot be claimed", () => {
    for (const s of ["captured", "voided", "cancelled", "failed"]) {
      expect(canReportOrder(s, null)).toBe(false);
    }
  });

  it("no double claims — one open dispute per order", () => {
    expect(canReportOrder("authorized", new Date())).toBe(false);
  });
});

describe("confirm receipt — buyer or carrier, never seller", () => {
  it("buyer can confirm while escrow is open and undelivered", () => {
    expect(canConfirmReceipt("authorized", null)).toBe(true);
    expect(canConfirmReceipt("shipped", null)).toBe(true);
  });

  it("cannot confirm twice or after close", () => {
    expect(canConfirmReceipt("authorized", new Date())).toBe(false);
    expect(canConfirmReceipt("captured", null)).toBe(false);
    expect(canConfirmReceipt("voided", null)).toBe(false);
  });

  it("no confirmation before the money is held", () => {
    for (const s of ["created", "approved"]) {
      expect(canConfirmReceipt(s, null)).toBe(false);
    }
  });

  it("an open claim blocks confirmation — fix the problem first", () => {
    expect(canConfirmReceipt("shipped", null, new Date())).toBe(false);
    expect(canConfirmReceipt("shipped", null, null)).toBe(true);
  });
});

describe("reviews — only after value actually moved", () => {
  it("captured and delivered orders are reviewable", () => {
    expect(canReviewOrder("captured")).toBe(true);
    expect(canReviewOrder("delivered")).toBe(true);
  });

  it("open escrows are not — no reviews on promises", () => {
    for (const s of ["created", "approved", "authorized", "shipped", "voided"]) {
      expect(canReviewOrder(s)).toBe(false);
    }
  });
});
