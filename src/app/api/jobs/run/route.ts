import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { GET as runWatchdog } from "../escrow-watch/route";

export const maxDuration = 60;

/**
 * Manual watchdog trigger — lets a signed-in user run the same reconcile pass
 * the cron performs, so deliveries, price drops and deals surface on demand.
 * The session authorizes the call; the cron secret authorizes the handler.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!env.cronSecret)
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  const res = await runWatchdog(
    new Request("https://parley.internal/api/jobs/escrow-watch", {
      headers: { authorization: `Bearer ${env.cronSecret}` },
    }),
  );
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
