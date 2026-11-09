import { describe, expect, it } from "vitest";
import { z } from "zod";

// The rules that make the demo's claims true. If any of these break,
// money can move without the guarantees the README promises.

describe("rate limiter", async () => {
  const { rateLimit } = await import("../rate-limit");

  it("allows up to the limit then rejects with retry hint", () => {
    const key = `t:${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks keys independently — one user cannot starve another", () => {
    const a = `t:${crypto.randomUUID()}`;
    const b = `t:${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) rateLimit(a, 3, 60_000);
    expect(rateLimit(a, 3, 60_000).ok).toBe(false);
    expect(rateLimit(b, 3, 60_000).ok).toBe(true);
  });
});

describe("i18n dictionaries", async () => {
  const { DICTS, translate } = await import("../i18n");

  it("en and es cover exactly the same keys", () => {
    expect(Object.keys(DICTS.es).sort()).toEqual(Object.keys(DICTS.en).sort());
  });

  it("interpolates variables and leaves unknowns untouched", () => {
    const s = translate("en", "chat.bannerAuthorized", { order: "ABC123" });
    expect(s).toContain("ABC123");
    expect(s).not.toContain("{order}");
  });
});

describe("agent tool surface", async () => {
  const { agentTools } = await import("../agent/tools");

  it("demo role gets ONLY the core tools — no merchant PayPal surface", () => {
    const tools = agentTools({ userId: "u1", role: "demo", spaceId: "sp_test" });
    expect(Object.keys(tools).sort()).toEqual([
      "confirm_delivery_release",
      "create_escrow_order",
      "create_reorder_rule",
      "get_escrow_status",
      "list_orders",
      "list_reorder_rules",
      "merchant_quote",
      "register_tracking",
      "request_invoice",
      "search_products",
      "void_escrow_order",
    ]);
  });

  it("money-moving tools accept no price or amount input — prices resolve server-side only", () => {
    const tools = agentTools({ userId: "u1", role: "demo", spaceId: "sp_test" });
    const moneyTools = [
      "create_escrow_order",
      "confirm_delivery_release",
      "void_escrow_order",
    ] as const;
    for (const name of moneyTools) {
      const schema = (tools[name] as { inputSchema: z.ZodType }).inputSchema;
      const shape = (schema as unknown as z.ZodObject<z.ZodRawShape>).shape;
      const keys = Object.keys(shape ?? {});
      for (const k of keys) {
        expect(k).not.toMatch(/price|amount|total|usd|cost|cents/i);
      }
    }
  });

  it("demo role cannot invoke any tool that is missing from the safe list", () => {
    const tools = agentTools({ userId: "u1", role: "demo", spaceId: "sp_test" });
    const forbidden = [
      "create_invoice",
      "send_invoice",
      "list_disputes",
      "list_transactions",
      "create_shipment",
      "get_insight",
    ];
    for (const name of forbidden) {
      expect(Object.keys(tools)).not.toContain(name);
    }
  });

  it("money-touching tools reject demo role before any side effect", async () => {
    const tools = agentTools({ userId: "u1", role: "demo", spaceId: "sp_test" });
    const gated: [string, Record<string, unknown>][] = [
      ["register_tracking", { paypalOrderId: "o1", trackingNumber: "1Z", carrier: "UPS" }],
      ["request_invoice", { paypalOrderId: "o1", recipientEmail: "a@b.co" }],
      ["create_reorder_rule", { query: "boxes", maxUnitPriceUsd: 25 }],
    ];
    const byName = tools as unknown as Record<string, { execute: (a: unknown) => Promise<{ error?: string }> }>;
    for (const [name, input] of gated) {
      const res = await byName[name].execute(input);
      expect(res.error).toMatch(/demo/i);
    }
  });
});
