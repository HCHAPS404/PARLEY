import { getDb, ensureDb } from "./db";
import { auditLog } from "./db/schema";

export type Actor = "user" | "agent" | "merchant" | "system";

/**
 * Append-only audit trail. Every consequential action is recorded with its
 * rationale — the "black box recorder" for the trust story. Never throws:
 * an audit failure must not break a purchase flow, only log loudly.
 */
export async function audit(entry: {
  actor: Actor;
  action: string;
  userId?: string;
  spaceId?: string;
  input?: unknown;
  output?: unknown;
  rationale?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}): Promise<void> {
  try {
    await ensureDb();
    await getDb()
      .insert(auditLog)
      .values({
        actor: entry.actor,
        userId: entry.userId ?? null,
        spaceId: entry.spaceId ?? null,
        action: entry.action,
        input: entry.input == null ? null : JSON.parse(JSON.stringify(entry.input)),
        output:
          entry.output == null ? null : JSON.parse(JSON.stringify(entry.output)),
        rationale: entry.rationale ?? null,
        tokensIn: entry.tokensIn ?? null,
        tokensOut: entry.tokensOut ?? null,
        costUsd: entry.costUsd != null ? String(entry.costUsd) : null,
      });
  } catch (e) {
    console.error("[audit] failed:", e);
  }
}
