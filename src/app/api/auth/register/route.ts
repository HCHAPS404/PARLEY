import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createUser,
  createSession,
  newSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";
import { ensureDb, getDb } from "@/lib/db";
import { merchantProfiles, users } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { or, eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { createSpace } from "@/lib/spaces";

const body = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_-]+$/, "letters, numbers, _ and - only"),
  email: z.string().email(),
  password: z.string().min(8, "at least 8 characters"),
  persona: z.enum(["buyer", "seller"]).default("buyer"),
});

/** Public registration — creates a *user* (member) account: full buyer agent, no merchant-account surface. Admins are env-seeded. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  const { username, email, password, persona } = parsed.data;

  const clash = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, email.toLowerCase()), eq(users.username, username)))
    .limit(1);
  if (clash.length)
    return NextResponse.json(
      { error: "Username or email already taken" },
      { status: 409 },
    );

  const userId = await createUser({ username, email, password, persona });
  await createSpace(userId, "Personal");
  // Sellers get their merchant agent deployed at signup — ready to sell.
  if (persona === "seller") {
    await ensureDb();
    await getDb().insert(merchantProfiles).values({
      id: `merch_${randomUUID().slice(0, 8)}`,
      userId,
      displayName: `${username}'s store`,
    });
  }
  const token = newSessionToken();
  await createSession(userId, token, {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  await audit({
    actor: "user",
    action: "register",
    input: { username },
    userId,
  });

  const res = NextResponse.json({
    ok: true,
    user: { username, email: email.toLowerCase(), role: "user" },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return res;
}
