import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { ensureDb, getDb } from "./db";
import { policies, spaces } from "./db/schema";

export const SPACE_COOKIE = "parley_space";

export type Space = {
  id: string;
  userId: string;
  name: string;
  color: string;
};

export async function listSpaces(userId: string): Promise<Space[]> {
  await ensureDb();
  return getDb()
    .select({ id: spaces.id, userId: spaces.userId, name: spaces.name, color: spaces.color })
    .from(spaces)
    .where(eq(spaces.userId, userId))
    .orderBy(asc(spaces.createdAt));
}

/** The user's first space, creating "Personal" (+ its policy) if none exists. */
export async function getOrCreateDefaultSpace(userId: string): Promise<Space> {
  const existing = await listSpaces(userId);
  if (existing[0]) return existing[0];
  return createSpace(userId, "Personal", "teal");
}

export async function createSpace(
  userId: string,
  name: string,
  color = "teal",
): Promise<Space> {
  await ensureDb();
  const db = getDb();
  const space: Space = { id: randomUUID(), userId, name: name.trim() || "Space", color };
  await db.insert(spaces).values(space);
  // Each space owns a policy row cloned from the 'default' template — spend
  // caps are enforced per space, never shared across clients.
  const [tpl] = await db.select().from(policies).where(eq(policies.id, "default")).limit(1);
  await db.insert(policies).values({
    id: `pol_${space.id}`,
    spaceId: space.id,
    name: tpl?.name ?? "Default spend policy",
    maxPerTxCents: tpl?.maxPerTxCents ?? 25000,
    dailyCapCents: tpl?.dailyCapCents ?? 75000,
    monthlyCapCents: tpl?.monthlyCapCents ?? 300000,
    autonomousLimitCents: tpl?.autonomousLimitCents ?? 5000,
    allowedVendors: tpl?.allowedVendors ?? null,
    active: true,
  });
  return space;
}

export async function updateSpace(
  userId: string,
  spaceId: string,
  patch: { name?: string; color?: string },
): Promise<boolean> {
  await ensureDb();
  const rows = await getDb()
    .update(spaces)
    .set({
      ...(patch.name != null ? { name: patch.name.trim() || "Space" } : {}),
      ...(patch.color != null ? { color: patch.color } : {}),
    })
    .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)))
    .returning();
  return rows.length > 0;
}

/**
 * Active space resolution: cookie `parley_space` if it names a space the user
 * owns, otherwise their default. Always returns a real space — callers never
 * deal with "no space".
 */
export async function getActiveSpace(userId: string): Promise<Space> {
  const wanted = (await cookies()).get(SPACE_COOKIE)?.value;
  const all = await listSpaces(userId);
  const hit = wanted ? all.find((s) => s.id === wanted) : undefined;
  return hit ?? all[0] ?? (await getOrCreateDefaultSpace(userId));
}
