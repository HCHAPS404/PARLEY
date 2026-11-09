import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { listSpaces, SPACE_COOKIE } from "@/lib/spaces";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const all = await listSpaces(user.id);
  const space = all.find((s) => s.id === id);
  if (!space)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  (await cookies()).set(SPACE_COOKIE, space.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true, activeId: space.id });
}
