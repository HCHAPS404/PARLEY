import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { SYSTEM_PROMPT } from "@/lib/agent/system";
import { agentTools } from "@/lib/agent/tools";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

export const maxDuration = 120;

function getModel() {
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

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: agentTools(),
    stopWhen: stepCountIs(14),
    maxOutputTokens: 4096,
    onFinish: async ({ usage }) => {
      await audit({
        actor: "agent",
        action: "chat_turn",
        output: { finishUsage: usage },
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
