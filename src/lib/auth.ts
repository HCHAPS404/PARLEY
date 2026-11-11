import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { cookies } from "next/headers";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { getDb, ensureDb } from "./db";
import { users, sessions, messages, conversations } from "./db/schema";

/**
 * Session auth — scrypt password hashing, opaque bearer tokens stored
 * SHA-256'd in the DB, httpOnly cookies. Three roles:
 *   admin — full agent + merchant-account PayPal toolkit (the owner's books)
 *   user  — full buyer agent: spend tools gated by policy, generous daily cap
 *   demo  — read-mostly agent: search/negotiate allowed, spend tools blocked,
 *           hard daily message cap so API tokens can't be drained
 */

export const SESSION_COOKIE = "parley_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const DEMO_DAILY_LIMIT = 15;
export const USER_DAILY_LIMIT = 100;

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  role: "admin" | "user" | "demo";
  persona: "buyer" | "seller";
};

// ─── Passwords ──────────────────────────────────────────────────────
// Format: "s2:<saltHex>:<hashHex>" — scrypt N=16384, 64-byte key.
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `s2:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [tag, salt, hash] = stored.split(":");
  if (tag !== "s2" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ─── Sessions ───────────────────────────────────────────────────────
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  userId: string,
  token: string,
  meta: { ip?: string; userAgent?: string },
) {
  await ensureDb();
  await getDb()
    .insert(sessions)
    .values({
      id: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  await getDb()
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
}

export async function destroySession(token: string) {
  await ensureDb();
  await getDb().delete(sessions).where(eq(sessions.id, sha256(token)));
}

/** Read the session cookie and resolve it to a narrow user. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureDb();
  const rows = await getDb()
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sha256(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt && row.session.expiresAt < new Date()) {
    await getDb().delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }
  return {
    id: row.user.id,
    username: row.user.username,
    email: row.user.email,
    role:
      row.user.role === "admin"
        ? "admin"
        : row.user.role === "demo"
          ? "demo"
          : "user",
    persona: row.user.persona === "seller" ? "seller" : "buyer",
  };
}

export async function findUserByEmail(email: string) {
  await ensureDb();
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "user" | "demo";
  persona?: "buyer" | "seller";
}) {
  await ensureDb();
  const id = randomUUID();
  await getDb()
    .insert(users)
    .values({
      id,
      username: input.username,
      email: input.email.toLowerCase(),
      passwordHash: hashPassword(input.password),
      role: input.role ?? "user",
      persona: input.persona ?? "buyer",
    });
  return id;
}

// ─── Brute-force guard (in-memory, per instance) ────────────────────
const attempts = new Map<string, { count: number; resetAt: number }>();

export function loginAllowed(key: string): boolean {
  const a = attempts.get(key);
  return !a || a.resetAt < Date.now() || a.count < 8;
}

export function loginFailed(key: string) {
  const a = attempts.get(key);
  if (!a || a.resetAt < Date.now()) {
    attempts.set(key, { count: 1, resetAt: Date.now() + 5 * 60 * 1000 });
  } else {
    a.count += 1;
  }
}

export function loginSucceeded(key: string) {
  attempts.delete(key);
}

// ─── Demo quota ─────────────────────────────────────────────────────
/** Count today's user-role messages — demo gets DEMO_DAILY_LIMIT, user USER_DAILY_LIMIT. */
export async function messagesToday(userId: string): Promise<number> {
  await ensureDb();
  const res = (await getDb().execute(
    sql`select count(*)::int as c from messages
        where user_id = ${userId} and role = 'user'
        and created_at >= date_trunc('day', now())`,
  )) as unknown;
  const rows = Array.isArray(res) ? res : (res as { rows?: { c: number }[] })?.rows ?? [];
  return Number(rows[0]?.c ?? 0);
}

// ─── Conversations & history ────────────────────────────────────────
export async function listConversations(userId: string, spaceId?: string) {
  await ensureDb();
  const scope = spaceId
    ? and(eq(conversations.userId, userId), eq(conversations.spaceId, spaceId))
    : eq(conversations.userId, userId);

  // Lazy migration: pre-conversations history gets folded into one thread so
  // nothing the user had before disappears.
  const orphans = await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(
      spaceId
        ? and(
            eq(messages.userId, userId),
            eq(messages.spaceId, spaceId),
            isNull(messages.conversationId),
          )
        : and(eq(messages.userId, userId), isNull(messages.conversationId)),
    )
    .limit(1);
  if (orphans.length) {
    const legacyId = randomUUID();
    await getDb()
      .insert(conversations)
      .values({ id: legacyId, userId, spaceId: spaceId ?? null, title: "Previous chat" });
    await getDb()
      .update(messages)
      .set({ conversationId: legacyId })
      .where(
        spaceId
          ? and(
              eq(messages.userId, userId),
              eq(messages.spaceId, spaceId),
              isNull(messages.conversationId),
            )
          : and(eq(messages.userId, userId), isNull(messages.conversationId)),
      );
  }

  return getDb()
    .select()
    .from(conversations)
    .where(scope)
    .orderBy(desc(conversations.createdAt));
}

export async function createConversation(userId: string, spaceId: string, title: string) {
  await ensureDb();
  const id = randomUUID();
  const safeTitle = title.trim().slice(0, 80) || "New chat";
  await getDb()
    .insert(conversations)
    .values({ id, userId, spaceId, title: safeTitle });
  return { id, title: safeTitle };
}

/** Returns the conversation only if it belongs to this user — callers scope by space separately. */
export async function getOwnedConversation(userId: string, id: string) {
  const rows = await getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteConversation(userId: string, id: string) {
  const owned = await getOwnedConversation(userId, id);
  if (!owned) return false;
  await getDb()
    .delete(messages)
    .where(and(eq(messages.conversationId, id), eq(messages.userId, userId)));
  await getDb().delete(conversations).where(eq(conversations.id, id));
  return true;
}

export async function saveMessage(
  userId: string,
  role: "user" | "assistant",
  parts: unknown,
  spaceId?: string,
  conversationId?: string,
) {
  await getDb()
    .insert(messages)
    .values({
      userId,
      spaceId: spaceId ?? null,
      conversationId: conversationId ?? null,
      role,
      parts: parts == null ? null : JSON.parse(JSON.stringify(parts)),
    });
}

export async function loadHistory(
  userId: string,
  spaceId?: string,
  conversationId?: string,
  limit = 60,
) {
  await ensureDb();
  const filters = [eq(messages.userId, userId)];
  if (spaceId) filters.push(eq(messages.spaceId, spaceId));
  if (conversationId) filters.push(eq(messages.conversationId, conversationId));
  const rows = await getDb()
    .select()
    .from(messages)
    .where(and(...filters))
    .orderBy(desc(messages.id))
    .limit(limit);
  return rows
    .reverse()
    .map((r) => ({ id: `db-${r.id}`, role: r.role, parts: (r.parts as unknown[]) ?? [] }));
}
