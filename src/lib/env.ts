/**
 * Centralized environment access. Secrets are only ever read server-side;
 * anything the browser needs is prefixed NEXT_PUBLIC_ and is safe by design
 * (the PayPal client id is public by PayPal's own model).
 */
export const env = {
  paypalClientId: process.env.PAYPAL_CLIENT_ID ?? "",
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
  paypalEnv: (process.env.PAYPAL_ENV ?? "sandbox") as "sandbox" | "live",

  googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
  metaApiKey: process.env.META_API_KEY ?? "",
  metaBaseUrl: process.env.META_BASE_URL ?? "https://api.meta.ai/v1",
  metaModel: process.env.META_MODEL ?? "muse-spark-1.3",

  modalApiKey: process.env.MODAL_API_KEY ?? "",
  modalBaseUrl:
    process.env.MODAL_BASE_URL ?? "https://inference.us-west.modal.direct/v1",
  modalModel: process.env.MODAL_MODEL ?? "zai-org/GLM-5.3-Flash",

  llmProvider: (process.env.LLM_PROVIDER ?? "google") as
    | "google"
    | "meta"
    | "modal",

  channel3ApiKey: process.env.CHANNEL3_API_KEY ?? "",

  databaseUrl: process.env.DATABASE_URL ?? "",

  cronSecret: process.env.CRON_SECRET ?? "",
  mcpSecret: process.env.MCP_SECRET ?? "",

  adminUsername: process.env.ADMIN_USERNAME ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",

  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export const paypalBaseUrl =
  env.paypalEnv === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
