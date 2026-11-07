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
  llamaApiKey: process.env.LLAMA_API_KEY ?? "",
  llamaBaseUrl: process.env.LLAMA_BASE_URL ?? "https://api.llama.com/compat/v1",
  llamaModel: process.env.LLAMA_MODEL ?? "Llama-4-Maverick-17B-128E-Instruct-FP8",
  llmProvider: (process.env.LLM_PROVIDER ?? "google") as "google" | "llama",

  channel3ApiKey: process.env.CHANNEL3_API_KEY ?? "",

  databaseUrl: process.env.DATABASE_URL ?? "",

  cronSecret: process.env.CRON_SECRET ?? "",

  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export const paypalBaseUrl =
  env.paypalEnv === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
