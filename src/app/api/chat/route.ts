import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/agent/system";
import { getModel } from "@/lib/agent/model";
import { agentTools } from "@/lib/agent/tools";
import { audit } from "@/lib/audit";
import {
  getSessionUser,
  messagesToday,
  saveMessage,
  getOwnedConversation,
  DEMO_DAILY_LIMIT,
  USER_DAILY_LIMIT,
} from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Per-role token quota — admin unbounded, members generous, demo tight.
  const dailyLimit =
    user.role === "admin"
      ? null
      : user.role === "demo"
        ? DEMO_DAILY_LIMIT
        : USER_DAILY_LIMIT;
  if (dailyLimit !== null) {
    const today = await messagesToday(user.id);
    if (today >= dailyLimit) {
      return NextResponse.json(
        { error: `Daily message limit reached (${dailyLimit}/day).` },
        { status: 429 },
      );
    }
  }

  const space = await getActiveSpace(user.id);
  const { messages, conversationId } = await req.json();

  // Only persist into a thread the user actually owns in this space.
  let convId: string | undefined;
  if (typeof conversationId === "string" && conversationId) {
    const owned = await getOwnedConversation(user.id, conversationId);
    if (owned && owned.spaceId === space.id) convId = conversationId;
  }

  // Persist the incoming user message for durable history.
  const last = messages?.[messages.length - 1];
  if (last?.role === "user") {
    try {
      await saveMessage(user.id, "user", last.parts ?? [], space.id, convId);
    } catch (e) {
      console.error("[chat] persist user msg failed:", e);
    }
  }

  // An attached image becomes visual-search context — the model picks the
  // intent, the server supplies the bytes (they never round-trip the prompt).
  const imgPart = (
    last?.role === "user" ? (last.parts as unknown[]) : []
  ).find(
    (p): p is { type: string; mediaType?: string; url?: string } =>
      typeof p === "object" &&
      p !== null &&
      (p as { type?: string }).type === "file" &&
      (p as { mediaType?: string }).mediaType?.startsWith("image/") === true &&
      typeof (p as { url?: string }).url === "string",
  );
  const dataUrl = imgPart?.url ?? "";
  const lastImage = dataUrl.startsWith("data:")
    ? {
        base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
        mediaType: imgPart!.mediaType!,
      }
    : undefined;

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: agentTools({
      userId: user.id,
      role: user.role,
      spaceId: space.id,
      lastImage,
    }),
    stopWhen: stepCountIs(14),
    maxOutputTokens: 4096,
    onFinish: async ({ usage, text }) => {
      try {
        if (text) {
          await saveMessage(user.id, "assistant", [{ type: "text", text }], space.id, convId);
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
