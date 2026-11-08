/**
 * In-memory sliding-window rate limiter. One instance per server process —
 * correct on Render's single-instance Starter plan. Keys are user ids, so
 * limits follow the account, not the IP (multiple users behind NAT are fine).
 */
const hits = new Map<string, number[]>();

// Bounded: old keys are pruned on every check.
const MAX_KEYS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (hits.size > MAX_KEYS) hits.clear();

  const window = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (window.length >= limit) {
    const oldest = window[0];
    hits.set(key, window);
    return { ok: false, retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  window.push(now);
  hits.set(key, window);
  return { ok: true, retryAfterSec: 0 };
}
