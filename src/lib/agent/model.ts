import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "../env";

/** The buyer agent's model — also used for sub-agent calls (merchant A2A). */
export function getModel() {
  if (env.llmProvider === "meta" && env.metaApiKey) {
    const meta = createOpenAICompatible({
      name: "meta",
      baseURL: env.metaBaseUrl,
      apiKey: env.metaApiKey,
    });
    return meta(env.metaModel);
  }
  if (env.llmProvider === "modal" && env.modalApiKey) {
    const modal = createOpenAICompatible({
      name: "modal",
      baseURL: env.modalBaseUrl,
      apiKey: env.modalApiKey,
    });
    return modal(env.modalModel);
  }
  return google("gemini-2.5-flash");
}
