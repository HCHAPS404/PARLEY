import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findUserByEmail,
  verifyPassword,
  createSession,
  newSessionToken,
  loginAllowed,
  loginFailed,
  loginSucceeded,
  SESSION_COOKIE,
} from "@/lib/auth";
import { audit } from "@/lib/audit";

const body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { email, password } = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${email.toLowerCase()}:${ip ?? "?"}`;
  if (!loginAllowed(key))
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes" },
      { status: 429 },
    );

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    loginFailed(key);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  loginSucceeded(key);

  const token = newSessionToken();
  await createSession(user.id, token, {
    ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  await audit({
    actor: "user",
    action: "login",
    input: { username: user.username },
    userId: user.id,
  });

  const res = NextResponse.json({
    ok: true,
    user: { username: user.username, email: user.email, role: user.role },
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
