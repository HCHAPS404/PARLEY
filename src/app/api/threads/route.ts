import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDb, getDb } from "@/lib/db";
import { dealMessages, dealThreads, merchantProfiles, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ensureThread, postMessage } from "@/lib/relationships";
import { audit } from "@/lib/audit";

export const maxDuration = 30;

/**
 * GET — my threads (buyer sees sellers, seller sees buyers) with the
 * counterpart's display name, last message preview and unread count.
 * POST — send a message {threadId, body} or open a thread {openWith, body}.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDb();
  const db = getDb();
  const asSeller = user.persona === "seller";
  const rows = await db
    .select()
    .from(dealThreads)
    .where(
      asSeller
        ? eq(dealThreads.sellerUserId, user.id)
        : eq(dealThreads.buyerUserId, user.id),
    )
    .orderBy(desc(dealThreads.lastMsgAt))
    .limit(50);

  // Enrich each thread with the counterpart's display name + last message.
  const threads = await Promise.all(
    rows.map(async (t) => {
      const [last] = await db
        .select()
        .from(dealMessages)
        .where(eq(dealMessages.threadId, t.id))
        .orderBy(desc(dealMessages.createdAt))
        .limit(1);
      let counterpart: string;
      if (asSeller) {
        const [b] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, t.buyerUserId))
          .limit(1);
        counterpart = b?.username ?? t.buyerLabel ?? "buyer";
      } else {
        const [mp] = await db
          .select({ displayName: merchantProfiles.displayName })
          .from(merchantProfiles)
          .where(eq(merchantProfiles.userId, t.sellerUserId))
          .limit(1);
        counterpart = mp?.displayName ?? "seller";
      }
      return {
        id: t.id,
        subject: t.subject,
        counterpart,
        lastMsg: last ? { body: last.body, role: last.senderRole, at: last.createdAt } : null,
        unread: asSeller ? t.sellerUnread : t.buyerUnread,
        lastMsgAt: t.lastMsgAt,
      };
    }),
  );
  return NextResponse.json({ threads });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    threadId?: string;
    openWith?: string; // buyer opens with a seller's userId
    body?: string;
    subject?: string;
  };
  const text = String(body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "body required" }, { status: 400 });
  await ensureDb();
  const db = getDb();
  const asSeller = user.persona === "seller";

  let threadId = body.threadId ? String(body.threadId) : null;

  if (!threadId) {
    // Opening a new thread — only a buyer initiates (sellers reply / send offers).
    if (asSeller) return NextResponse.json({ error: "Sellers reply on existing threads" }, { status: 400 });
    const sellerUserId = String(body.openWith ?? "");
    if (!sellerUserId) return NextResponse.json({ error: "openWith required" }, { status: 400 });
    const t = await ensureThread({
      buyerUserId: user.id,
      sellerUserId,
      buyerLabel: `parley-user-${user.id.slice(0, 8)}`,
      subject: body.subject ? String(body.subject).slice(0, 120) : null,
    });
    threadId = t.id;
  } else {
    // Membership check — you can only write where you're a party.
    const [t] = await db
      .select()
      .from(dealThreads)
      .where(
        and(
          eq(dealThreads.id, threadId),
          asSeller
            ? eq(dealThreads.sellerUserId, user.id)
            : eq(dealThreads.buyerUserId, user.id),
        ),
      )
      .limit(1);
    if (!t) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { id } = await postMessage({
    threadId,
    senderUserId: user.id,
    senderRole: asSeller ? "seller" : "buyer",
    body: text,
  });
  await audit({
    actor: "user", action: "deal_message_sent", userId: user.id,
    input: { threadId, role: asSeller ? "seller" : "buyer", chars: text.length },
    rationale: "Direct buyer↔seller message on a deal thread",
  });
  return NextResponse.json({ ok: true, id, threadId });
}

/** GET ?thread= — one thread's messages, marks my side read. */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { threadId } = (await req.json()) as { threadId?: string };
  if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });
  await ensureDb();
  const db = getDb();
  const asSeller = user.persona === "seller";
  const [t] = await db
    .select()
    .from(dealThreads)
    .where(
      and(
        eq(dealThreads.id, threadId),
        asSeller
          ? eq(dealThreads.sellerUserId, user.id)
          : eq(dealThreads.buyerUserId, user.id),
      ),
    )
    .limit(1);
  if (!t) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const msgs = await db
    .select()
    .from(dealMessages)
    .where(eq(dealMessages.threadId, threadId))
    .orderBy(dealMessages.createdAt)
    .limit(200);
  await db
    .update(dealThreads)
    .set(asSeller ? { sellerUnread: 0 } : { buyerUnread: 0 })
    .where(eq(dealThreads.id, threadId));
  return NextResponse.json({ thread: t, messages: msgs });
}
