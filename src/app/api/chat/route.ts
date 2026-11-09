import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/agent/system";
import { agentTools } from "@/lib/agent/tools";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import {
  getSessionUser,
  messagesToday,
  saveMessage,
  DEMO_DAILY_LIMIT,
} from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

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
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Demo quota — only the admin may spend unbounded LLM tokens.
  if (user.role !== "admin") {
    const today = await messagesToday(user.id);
    if (today >= DEMO_DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `Demo daily limit reached (${DEMO_DAILY_LIMIT} messages/day). Ask the workspace owner for admin access.`,
        },
        { status: 429 },
      );
    }
  }

  const space = await getActiveSpace(user.id);
  const { messages } = await req.json();

  // Persist the incoming user message for durable history.
  const last = messages?.[messages.length - 1];
  if (last?.role === "user") {
    try {
      await saveMessage(user.id, "user", last.parts ?? [], space.id);
    } catch (e) {
      console.error("[chat] persist user msg failed:", e);
    }
  }

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: agentTools({ userId: user.id, role: user.role, spaceId: space.id }),
    stopWhen: stepCountIs(14),
    maxOutputTokens: 4096,
    onFinish: async ({ usage, text }) => {
      try {
        if (text) {
          await saveMessage(user.id, "assistant", [{ type: "text", text }], space.id);
        }
      } catch (e) {
        console.error("[chat] persist assistant msg failed:", e);
      }
      await audit({
        actor: "agent",
        action: "chat_turn",
        userId: user.id,
        spaceId: space.id,
        output: { finishUsage: usage },
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
