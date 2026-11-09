import { NextResponse } from "next/server";
import { getSessionUser, loadHistory, getOwnedConversation } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

/** Chat history for the signed-in user's active space — scoped to a thread. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const space = await getActiveSpace(user.id);
  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (conversationId) {
    const owned = await getOwnedConversation(user.id, conversationId);
    if (!owned || owned.spaceId !== space.id)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      messages: await loadHistory(user.id, space.id, conversationId),
    });
  }
  return NextResponse.json({ messages: await loadHistory(user.id, space.id) });
}
