import type { VercelRequest } from '@vercel/node';
import { Redis } from '@upstash/redis';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

// In-memory limiter pre serverless runtime (best effort na úrovni jednej inštancie).
const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_KEY_PREFIX = 'rl';
const redisRestUrl =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const redisRestToken =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const hasPersistentRateLimitConfig = Boolean(
  redisRestUrl && redisRestToken
);
let redisClient: Redis | null | undefined;

const cleanupExpiredEntries = (now: number) => {
  if (rateLimitStore.size <= 5000) return;
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

export const getClientIp = (req: VercelRequest) => {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedValue) {
    const first = String(forwardedValue).split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers['x-real-ip'];
  const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
  if (realIpValue) return String(realIpValue).trim();

  return 'unknown';
};

const consumeInMemoryRateLimit = ({
  bucket,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult => {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const existing = rateLimitStore.get(bucket);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(bucket, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  rateLimitStore.set(bucket, existing);
  return { allowed: true, retryAfterSeconds: 0 };
};

const getRedisClient = (): Redis | null => {
  if (!hasPersistentRateLimitConfig) return null;
  if (redisClient !== undefined) {
    return redisClient;
  }

  try {
    redisClient = new Redis({
      url: redisRestUrl,
      token: redisRestToken,
    });
    return redisClient;
  } catch (error) {
    console.error('rate-limit redis client init error:', error);
    redisClient = null;
    return null;
  }
};

const consumePersistentRateLimit = async ({
  bucket,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult | null> => {
  const redis = getRedisClient();
  if (!redis) return null;

  const key = `${RATE_LIMIT_KEY_PREFIX}:${bucket}`;
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const count = Number(await redis.incr(key));
    if (!Number.isFinite(count) || count <= 0) {
      return null;
    }

    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }

    if (count > limit) {
      const kvTtl = Number(await redis.ttl(key));
      return {
        allowed: false,
        retryAfterSeconds: Number.isFinite(kvTtl) && kvTtl > 0 ? kvTtl : ttlSeconds,
      };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  } catch (error) {
    console.error('rate-limit redis consume error:', error);
    return null;
  }
};

export const consumeRateLimit = async (
  options: RateLimitOptions
): Promise<RateLimitResult> => {
  const persistent = await consumePersistentRateLimit(options);
  if (persistent) return persistent;
  return consumeInMemoryRateLimit(options);
};
