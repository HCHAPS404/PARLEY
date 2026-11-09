import { NextResponse } from "next/server";
import {
  getSessionUser,
  listConversations,
  createConversation,
  deleteConversation,
} from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

/** Conversation threads for the signed-in user's active space. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const space = await getActiveSpace(user.id);
  const convs = await listConversations(user.id, space.id);
  return NextResponse.json({
    conversations: convs.map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt })),
  });
}

/** Create a thread — title comes from the first user message client-side. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const space = await getActiveSpace(user.id);
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const conv = await createConversation(user.id, space.id, title ?? "New chat");
  return NextResponse.json({ conversation: conv });
}

/** Delete a thread and its messages — ownership enforced server-side. */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteConversation(user.id, id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
