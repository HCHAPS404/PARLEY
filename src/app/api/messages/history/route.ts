import { NextResponse } from "next/server";
import { getSessionUser, loadHistory } from "@/lib/auth";
import { getActiveSpace } from "@/lib/spaces";

/** Chat history for the signed-in user's active space. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const space = await getActiveSpace(user.id);
  return NextResponse.json({ messages: await loadHistory(user.id, space.id) });
}
