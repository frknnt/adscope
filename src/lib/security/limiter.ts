import "server-only";
import { getAdminRepo } from "@/lib/data";

/**
 * Shared rate limit (P7.1): one counter across every serverless instance, kept in Postgres
 * (rate_limit_hit, fixed window). In demo mode, or if the database is unreachable, it falls back to
 * the per-instance limiter. Callers pass hashed keys only (see hashKey), never raw e-mails or IPs.
 */
export async function limit(key: string, max: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  return getAdminRepo().rateLimitHit(key, max, Math.max(1, Math.round(windowMs / 1000)));
}
