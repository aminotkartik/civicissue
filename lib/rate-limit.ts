/**
 * In-memory sliding-window rate limiter (spec §59, §117).
 *
 * Suitable for single-instance deployments and development. For multi-instance
 * production, swap the `store` with a Redis-backed implementation — the
 * interface (`rateLimit(key, limit, windowMs)`) stays identical.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Periodic cleanup so long-running processes don't leak buckets.
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupTimer || typeof setInterval === "undefined") return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt < now) store.delete(key);
    }
  }, 60_000);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  ensureCleanup();
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** Preset limits for protected endpoints. */
export const LIMITS = {
  issueCreate: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  commentCreate: { limit: 20, windowMs: 10 * 60 * 1000 }, // 20/10min
  upvote: { limit: 60, windowMs: 10 * 60 * 1000 },
  login: { limit: 10, windowMs: 10 * 60 * 1000 }, // per IP+email
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 3, windowMs: 30 * 60 * 1000 },
  ai: { limit: 30, windowMs: 10 * 60 * 1000 },
  upload: { limit: 40, windowMs: 10 * 60 * 1000 },
  genericApi: { limit: 120, windowMs: 60 * 1000 },
} as const;

export function clientKey(req: Request, userId?: string | null): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return userId ? `u:${userId}` : `ip:${ip}`;
}

export class RateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(resetAt: number) {
    super("Too many requests. Please slow down and try again shortly.");
    this.name = "RateLimitError";
    this.retryAfterMs = Math.max(1000, resetAt - Date.now());
  }
}

export function checkRateLimit(
  key: string,
  preset: (typeof LIMITS)[keyof typeof LIMITS]
): void {
  const result = rateLimit(key, preset.limit, preset.windowMs);
  if (!result.ok) throw new RateLimitError(result.resetAt);
}
