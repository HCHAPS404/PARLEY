/**
 * Create two escrow orders (intent=AUTHORIZE, PayPal wallet) on sandbox and
 * print their approve URLs + ids. The orders get rows in prod's orders_local
 * via the Neon MCP (done separately) so the deployed return/capture/void
 * routes can be exercised end-to-end.
 *
 *   npx tsx scripts/make-escrow-pair.mts
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { createEscrowOrder } = await import("../src/lib/paypal");

const appUrl = "https://parley-wt1k.onrender.com";

for (const [tag, cents, title] of [
  ["CAPTURE", 500, "E2E capture-path test item"],
  ["VOID", 350, "E2E void-path test item"],
] as const) {
  const order = await createEscrowOrder({
    amountCents: cents,
    description: title,
    vendorName: "test-sandbox",
    returnUrl: `${appUrl}/api/paypal/return`,
    cancelUrl: `${appUrl}/api/paypal/cancel`,
  });
  const approve =
    order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href ??
    `https://www.sandbox.paypal.com/checkoutnow?token=${order.id}`;
  console.log(`${tag}: ${order.id} (${order.status})`);
  console.log(`  approve: ${approve}`);
}
process.exit(0);
