import { ensureDb } from "@/lib/db";
import { env } from "@/lib/env";

/** Render health check — also reports which dependencies are wired. */
export async function GET() {
  let db: "postgres" | "pglite" | "down" = env.databaseUrl ? "postgres" : "pglite";
  try {
    await ensureDb();
  } catch {
    db = "down";
  }
  return Response.json({
    ok: true,
    service: "parley",
    ts: new Date().toISOString(),
    db,
    configured: {
      paypal: Boolean(env.paypalClientId && env.paypalClientSecret),
      llm: Boolean(env.googleApiKey || env.metaApiKey || env.modalApiKey),
      channel3: Boolean(env.channel3ApiKey),
      // The A2A claim is verifiable — the merchant agent is only reachable
      // over the HTTP JSON-RPC boundary when the secret is wired.
      mcp: Boolean(env.mcpSecret),
    },
  });
}
