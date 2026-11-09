import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  createSpace,
  getActiveSpace,
  listSpaces,
  updateSpace,
} from "@/lib/spaces";

const COLORS = ["teal", "blue", "violet", "amber", "rose", "green"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [all, active] = await Promise.all([
    listSpaces(user.id),
    getActiveSpace(user.id),
  ]);
  return NextResponse.json({ spaces: all, activeId: active.id });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    color?: string;
  };
  const name = (body.name ?? "").trim();
  if (!name || name.length > 40)
    return NextResponse.json({ error: "name required (≤40 chars)" }, { status: 400 });
  const color = COLORS.includes(body.color ?? "") ? body.color! : "teal";
  const space = await createSpace(user.id, name, color);
  return NextResponse.json({ space }, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    color?: string;
  };
  if (!body.id)
    return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await updateSpace(user.id, body.id, {
    name: body.name,
    color: COLORS.includes(body.color ?? "") ? body.color : undefined,
  });
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
