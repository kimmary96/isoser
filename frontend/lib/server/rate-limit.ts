import { createHash } from "crypto";

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
const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() || "";
const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || "";

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

function toStorageKey(namespace: string, key: string): string {
  const hashedKey = createHash("sha256").update(`${namespace}:${key}`).digest("hex");
  return `rate-limit:${namespace}:${hashedKey}`;
}

function isUpstashConfigured(): boolean {
  return Boolean(upstashRestUrl && upstashRestToken);
}

async function callUpstash(command: string[]): Promise<unknown[] | null> {
  const [name, ...args] = command;
  const endpoint = `${upstashRestUrl}/${name.toLowerCase()}/${args.map((value) => encodeURIComponent(value)).join("/")}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashRestToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`upstash_${name.toLowerCase()}_${response.status}`);
  }

  const data = (await response.json()) as { result?: unknown; error?: string };
  if (data.error) {
    throw new Error(data.error);
  }

  return [data.result ?? null];
}

async function enforceMemoryRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const storageKey = toStorageKey(options.namespace, options.key);
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

async function enforceUpstashRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const storageKey = toStorageKey(options.namespace, options.key);
  const countResult = await callUpstash(["INCR", storageKey]);
  const count = Number(countResult?.[0] ?? 0);

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("upstash_invalid_count");
  }

  let ttlMs = 0;
  if (count === 1) {
    await callUpstash(["PEXPIRE", storageKey, String(options.windowMs)]);
    ttlMs = options.windowMs;
  } else {
    const ttlResult = await callUpstash(["PTTL", storageKey]);
    ttlMs = Number(ttlResult?.[0] ?? 0);
  }

  const retryAfterSeconds = Math.max(Math.ceil(Math.max(ttlMs, 0) / 1000), 1);

  if (count > options.maxRequests) {
    return {
      allowed: false,
      limit: options.maxRequests,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    limit: options.maxRequests,
    remaining: Math.max(options.maxRequests - count, 0),
    retryAfterSeconds,
  };
}

export function buildRateLimitKey(request: Request, namespace: string, suffix?: string): string {
  const clientIp = getClientIp(request);
  const normalizedSuffix = suffix?.trim() || "anonymous";
  return `${namespace}:${clientIp}:${normalizedSuffix}`;
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  if (isUpstashConfigured()) {
    try {
      return await enforceUpstashRateLimit(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.warn(`[rate-limit] upstash fallback: ${message}`);
    }
  }

  return enforceMemoryRateLimit(options);
}
