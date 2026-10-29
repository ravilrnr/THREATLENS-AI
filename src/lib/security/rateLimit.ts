export type RateLimitCategory = "analyze" | "remediation" | "verify";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMITS: Record<RateLimitCategory, number> = {
  analyze: 20,
  remediation: 30,
  verify: 10,
};

const WINDOW_MS = 60_000;
const MAX_BUCKETS = 5_000;

function configuredLimit(category: RateLimitCategory): number {
  const envName = `THREATLENS_RATE_LIMIT_${category.toUpperCase()}`;
  const raw = process.env[envName];
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000) {
    return Math.floor(parsed);
  }
  return DEFAULT_LIMITS[category];
}

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 100);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 100);
  return "anonymous";
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Small fixed-window limiter. It is intentionally process-local: it deters
 * casual abuse for a single instance, not distributed attacks. A production
 * deployment should use a shared limiter at the edge.
 */
export function consumeRateLimit(
  request: Request,
  category: RateLimitCategory,
  now: number = Date.now(),
): RateLimitResult {
  const limit = configuredLimit(category);
  const key = `${category}:${getClientKey(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
    prune(now);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }

  current.count += 1;
  const allowed = current.count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

function prune(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size >= MAX_BUCKETS) {
    const first = buckets.keys().next().value;
    if (first === undefined) break;
    buckets.delete(first);
  }
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed
      ? {}
      : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

export function getRateLimitLimits(): Record<RateLimitCategory, number> {
  return {
    analyze: configuredLimit("analyze"),
    remediation: configuredLimit("remediation"),
    verify: configuredLimit("verify"),
  };
}

/** Test helper: clear all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
