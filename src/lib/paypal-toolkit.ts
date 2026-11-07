import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { tool } from "ai";
import { env } from "./env";

type AnyTool = {
  description?: string;
  parameters?: unknown;
  inputSchema?: unknown;
  execute?: (...args: never[]) => unknown;
};

let cached: Record<string, unknown> | null = null;

/**
 * PayPal Agent Toolkit tools, normalized to AI SDK v7 shape.
 * Escrow order creation lives in ./paypal.ts instead (the toolkit only
 * supports intent=CAPTURE); here we expose the rest of the surface:
 * invoicing, disputes, transactions, shipment tracking, order reads, insights.
 */
export function paypalTools(): Record<string, unknown> {
  if (cached) return cached;
  const toolkit = new PayPalAgentToolkit({
    clientId: env.paypalClientId,
    clientSecret: env.paypalClientSecret,
    configuration: {
      actions: {
        invoices: {
          create: true,
          list: true,
          get: true,
          send: true,
          sendReminder: true,
          generateInvoiceNumber: true,
        },
        disputes: { list: true, get: true },
        transactions: { list: true },
        shipment: { create: true, get: true, update: true },
        orders: { get: true },
        insights: { get: true },
      },
      context: { sandbox: env.paypalEnv === "sandbox" },
    },
  });
  const raw = toolkit.getTools() as Record<string, AnyTool>;
  cached = Object.fromEntries(
    Object.entries(raw).map(([name, t]) => [
      name,
      tool({
        description: t.description ?? name,
        inputSchema: (t.inputSchema ?? t.parameters) as never,
        execute: async (input: unknown) => t.execute?.(input as never),
      }),
    ]),
  );
  return cached;
}
