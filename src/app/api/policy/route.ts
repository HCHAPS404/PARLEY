import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, ensureDb } from "@/lib/db";
import { policies } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

const patchSchema = z.object({
  maxPerTxCents: z.number().int().min(0).max(100_000_000).optional(),
  dailyCapCents: z.number().int().min(0).max(100_000_000).optional(),
  monthlyCapCents: z.number().int().min(0).max(100_000_000).optional(),
  autonomousLimitCents: z.number().int().min(0).max(100_000_000).optional(),
  allowedVendors: z.array(z.string().max(120)).max(50).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDb();
  const [policy] = await getDb()
    .select()
    .from(policies)
    .where(eq(policies.id, "default"))
    .limit(1);
  return NextResponse.json({ policy: policy ?? null, canEdit: user.role === "admin" });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success)
    return NextResponse.json({ error: "Invalid policy" }, { status: 400 });

  await ensureDb();
  const [updated] = await getDb()
    .update(policies)
    .set(body.data)
    .where(eq(policies.id, "default"))
    .returning();

  await audit({
    actor: "user",
    action: "policy_updated",
    userId: user.id,
    input: body.data,
    output: { policyId: updated?.id },
    rationale: "Admin edited deterministic spend policy",
  });

  return NextResponse.json({ policy: updated ?? null });
}
