type RateLimitOptions = {
  namespace: string;
  maxRequests: number;
  windowMs: number;
  key: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const rateLimitStore = new Map<string, RateLimitBucket>();

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function cleanupExpiredBuckets(now: number): void {
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function buildRateLimitKey(request: Request, namespace: string, suffix?: string): string {
  const clientIp = getClientIp(request);
  const normalizedSuffix = suffix?.trim() || "anonymous";
  return `${namespace}:${clientIp}:${normalizedSuffix}`;
}

export function enforceRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const storageKey = `${options.namespace}:${options.key}`;
  const current = rateLimitStore.get(storageKey);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(storageKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: Math.max(options.maxRequests - 1, 0),
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  if (current.count >= options.maxRequests) {
    return {
      allowed: false,
      limit: options.maxRequests,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }

  current.count += 1;
  rateLimitStore.set(storageKey, current);

  return {
    allowed: true,
    limit: options.maxRequests,
    remaining: Math.max(options.maxRequests - current.count, 0),
    retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
  };
}
