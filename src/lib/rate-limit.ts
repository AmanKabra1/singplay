import "server-only";

import { ApiError } from "@/lib/api/http";

/**
 * Fixed-window rate limiting, in process memory.
 *
 * Scope note: on a serverless platform each instance keeps its own counters, so
 * this is a speed bump against credential stuffing and mail-bombing rather than
 * a hard guarantee. That is the right trade-off here — it needs no Redis, costs
 * nothing, and the alternative (no limit at all) is meaningfully worse. Swap the
 * `hits` map for a shared store if this ever needs to be authoritative.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  // Amortised cleanup so the map can't grow without bound on a long-lived box.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimit = { limit: number; windowMs: number };

export const LIMITS = {
  login: { limit: 8, windowMs: 5 * 60_000 },
  signup: { limit: 5, windowMs: 15 * 60_000 },
  passwordReset: { limit: 4, windowMs: 15 * 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  search: { limit: 120, windowMs: 60_000 },
} satisfies Record<string, RateLimit>;

/** Best-effort client identity. Behind a proxy `x-forwarded-for` is the real IP. */
export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function enforceRateLimit(bucketKey: string, { limit, windowMs }: RateLimit) {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > limit) {
    const seconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw ApiError.tooMany(
      `Too many attempts. Try again in ${seconds > 60 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} seconds`}.`,
    );
  }
}

/** Convenience wrapper: `limit(request, "login", LIMITS.login)`. */
export function limit(request: Request, name: string, config: RateLimit) {
  enforceRateLimit(`${name}:${clientKey(request)}`, config);
}

/** Clears a bucket after a successful attempt, so honest users aren't punished. */
export function resetLimit(request: Request, name: string) {
  buckets.delete(`${name}:${clientKey(request)}`);
}
