import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { negotiations } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

export const maxDuration = 30;

/** The agent-to-agent transcript behind a negotiated order — the replay the
 * buyer watches in the pipeline drawer. Seller-side view comes via
 * seller_events, so only the buyer (owner) reads it here. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await ensureDb();
  const [n] = await getDb()
    .select()
    .from(negotiations)
    .where(eq(negotiations.id, id))
    .limit(1);
  if (!n || n.userId !== user.id)
    return NextResponse.json({ error: "Negotiation not found" }, { status: 404 });
  return NextResponse.json({
    id: n.id,
    status: n.status,
    listPriceCents: n.listPriceCents,
    agreedCents: n.agreedCents,
    transcript: n.transcript ?? [],
    createdAt: n.createdAt,
  });
}
