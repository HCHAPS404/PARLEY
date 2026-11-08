import { NextResponse } from "next/server";
import { getSessionUser, loadHistory } from "@/lib/auth";

/** Chat history for the signed-in user — restores context across reloads. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ messages: await loadHistory(user.id) });
}
