import { describe, expect, it } from "vitest";
import { evaluatePolicy, type PolicyLimits } from "../policy";
import { merchantRound } from "../agent/merchant";

// The deterministic core of the demo's two promises:
//   buyer side — "the model can never exceed my spending rules"
//   seller side — "the agent can never sell below my margin floor"

const POLICY: PolicyLimits = {
  maxPerTxCents: 100_00,
  dailyCapCents: 250_00,
  monthlyCapCents: 500_00,
  autonomousLimitCents: 25_00,
  allowedVendors: null,
  active: true,
};

const base = {
  policy: POLICY,
  amountCents: 50_00,
  daySpendCents: 0,
  monthSpendCents: 0,
};

describe("evaluatePolicy — the spend gate the agent cannot bypass", () => {
  it("denies when no policy exists or it is inactive", () => {
    expect(evaluatePolicy({ ...base, policy: null }).allow).toBe(false);
    expect(
      evaluatePolicy({ ...base, policy: { ...POLICY, active: false } }).allow,
    ).toBe(false);
  });

  it("denies amounts over the per-transaction cap", () => {
    const d = evaluatePolicy({ ...base, amountCents: 100_01 });
    expect(d.allow).toBe(false);
    expect(d.reason).toMatch(/per-transaction/i);
  });

  it("denies when the daily cap is already consumed", () => {
    const d = evaluatePolicy({ ...base, daySpendCents: 220_00 });
    expect(d.allow).toBe(false);
    expect(d.reason).toMatch(/daily/i);
  });

  it("denies when the monthly cap is already consumed", () => {
    const d = evaluatePolicy({ ...base, monthSpendCents: 480_00 });
    expect(d.allow).toBe(false);
    expect(d.reason).toMatch(/monthly/i);
  });

  it("enforces the vendor allowlist (substring, case-insensitive)", () => {
    const p = { ...POLICY, allowedVendors: ["acme", "globex"] };
    expect(evaluatePolicy({ ...base, policy: p, vendor: "acme.com" }).allow).toBe(true);
    expect(evaluatePolicy({ ...base, policy: p, vendor: "ACME Supply" }).allow).toBe(true);
    const denied = evaluatePolicy({ ...base, policy: p, vendor: "evil-store.io" });
    expect(denied.allow).toBe(false);
    expect(denied.reason).toMatch(/allowlist/i);
  });

  it("allowlist does not fire when the vendor is unknown", () => {
    const p = { ...POLICY, allowedVendors: ["acme"] };
    expect(evaluatePolicy({ ...base, policy: p }).allow).toBe(true);
  });

  it("flags human approval above the autonomous limit — even though it allows", () => {
    const below = evaluatePolicy({ ...base, amountCents: 25_00 });
    expect(below.allow).toBe(true);
    expect(below.requiresApproval).toBe(false);
    const above = evaluatePolicy({ ...base, amountCents: 25_01 });
    expect(above.allow).toBe(true);
    expect(above.requiresApproval).toBe(true);
  });

  it("returns the correct remaining budget after the spend", () => {
    const d = evaluatePolicy({ ...base, amountCents: 50_00, daySpendCents: 30_00 });
    expect(d.allow).toBe(true);
    expect(d.remainingDailyCents).toBe(250_00 - 30_00 - 50_00);
  });

  it("caps are checked before budget — a $200 order fails the tx cap, not the daily cap", () => {
    const d = evaluatePolicy({ ...base, amountCents: 200_00, daySpendCents: 240_00 });
    expect(d.reason).toMatch(/per-transaction/i);
  });
});

describe("merchantRound — the seller's margin floor is law", () => {
  const LIST = 100_00;
  const FLOOR = 85_00; // 85% default

  it("accepts at or above the floor at the offered price — never lower", () => {
    const r = merchantRound({ listPriceCents: LIST, offerCents: 92_00, roundsUsed: 1 });
    expect(r.action).toBe("accept");
    expect(r.priceCents).toBe(92_00);
  });

  it("accepts exactly at the floor", () => {
    const r = merchantRound({ listPriceCents: LIST, offerCents: FLOOR, roundsUsed: 1 });
    expect(r.action).toBe("accept");
    expect(r.priceCents).toBe(FLOOR);
  });

  it("never counters below the floor — across the whole offer range", () => {
    for (let offer = 1_00; offer < FLOOR; offer += 9_00) {
      const r = merchantRound({ listPriceCents: LIST, offerCents: offer, roundsUsed: 1 });
      expect(r.priceCents).toBeGreaterThanOrEqual(FLOOR);
      expect(["counter", "walk"]).toContain(r.action);
    }
  });

  it("near-floor offers get the floor as a take-it counter", () => {
    const r = merchantRound({ listPriceCents: LIST, offerCents: Math.round(FLOOR * 0.96), roundsUsed: 1 });
    expect(r.action).toBe("counter");
    expect(r.priceCents).toBe(FLOOR);
  });

  it("low offers get a counter inside the profitable band — floor to list", () => {
    const r = merchantRound({ listPriceCents: LIST, offerCents: 40_00, roundsUsed: 1 });
    expect(r.action).toBe("counter");
    expect(r.priceCents).toBe(Math.round((FLOOR + LIST) / 2));
    expect(r.priceCents).toBeGreaterThanOrEqual(FLOOR);
    expect(r.priceCents).toBeLessThanOrEqual(LIST);
  });

  it("walks when rounds are exhausted and the offer is below floor", () => {
    const r = merchantRound({ listPriceCents: LIST, offerCents: 60_00, roundsUsed: 4 });
    expect(r.action).toBe("walk");
    expect(r.priceCents).toBe(LIST);
  });

  it("still accepts on the last round if the offer is above floor", () => {
    const r = merchantRound({ listPriceCents: LIST, offerCents: 90_00, roundsUsed: 4 });
    expect(r.action).toBe("accept");
  });
});
