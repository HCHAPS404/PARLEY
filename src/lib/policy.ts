import { sql } from "drizzle-orm";
import { getDb, ensureDb } from "./db";
import { policies } from "./db/schema";
import { eq } from "drizzle-orm";

export interface PolicyDecision {
  allow: boolean;
  requiresApproval: boolean;
  reason: string;
  remainingDailyCents: number;
  remainingMonthlyCents: number;
}

/**
 * The deterministic spending gate. This code — never the model — decides
 * whether money may move. The agent proposes; the policy engine disposes.
 */
export async function checkPolicy(input: {
  amountCents: number;
  vendor?: string;
}): Promise<PolicyDecision> {
  await ensureDb();
  const db = getDb();

  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.id, "default"))
    .limit(1);

  const fail = (reason: string): PolicyDecision => ({
    allow: false,
    requiresApproval: true,
    reason,
    remainingDailyCents: 0,
    remainingMonthlyCents: 0,
  });

  if (!policy || !policy.active) return fail("No active spend policy configured");

  const allowed = policy.allowedVendors as string[] | null;
  if (allowed?.length && input.vendor) {
    const ok = allowed.some((v) =>
      input.vendor!.toLowerCase().includes(v.toLowerCase()),
    );
    if (!ok) return fail(`Vendor "${input.vendor}" is not on the allowlist`);
  }

  if (input.amountCents > policy.maxPerTxCents) {
    return fail(
      `Amount $${(input.amountCents / 100).toFixed(2)} exceeds per-transaction cap of $${(policy.maxPerTxCents / 100).toFixed(2)}`,
    );
  }

  const spendRes = (await db.execute(sql`
    select
      coalesce(sum(case when created_at >= date_trunc('day', now()) then amount_cents else 0 end), 0) as day_spend,
      coalesce(sum(case when created_at >= date_trunc('month', now()) then amount_cents else 0 end), 0) as month_spend
    from orders_local
    where status in ('authorized', 'captured', 'approved')
  `)) as unknown;
  // drizzle/postgres-js returns RowList (iterable); drizzle/pglite returns { rows }.
  const rows = Array.isArray(spendRes)
    ? spendRes
    : (spendRes as { rows?: unknown[] })?.rows ?? [];
  const spend = rows[0] as { day_spend: number; month_spend: number } | undefined;

  const daySpend = Number(spend?.day_spend ?? 0);
  const monthSpend = Number(spend?.month_spend ?? 0);
  const remainingDaily = policy.dailyCapCents - daySpend;
  const remainingMonthly = policy.monthlyCapCents - monthSpend;

  if (input.amountCents > remainingDaily) {
    return fail(
      `Daily cap reached — $${(remainingDaily / 100).toFixed(2)} left of $${(policy.dailyCapCents / 100).toFixed(2)} today`,
    );
  }
  if (input.amountCents > remainingMonthly) {
    return fail(
      `Monthly cap reached — $${(remainingMonthly / 100).toFixed(2)} left of $${(policy.monthlyCapCents / 100).toFixed(2)} this month`,
    );
  }

  return {
    allow: true,
    requiresApproval: input.amountCents > policy.autonomousLimitCents,
    reason:
      input.amountCents > policy.autonomousLimitCents
        ? `Within caps — human approval required (above $${(policy.autonomousLimitCents / 100).toFixed(2)} autonomous limit)`
        : "Within caps and under autonomous limit",
    remainingDailyCents: remainingDaily - input.amountCents,
    remainingMonthlyCents: remainingMonthly - input.amountCents,
  };
}
