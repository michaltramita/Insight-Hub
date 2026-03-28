import type { VercelRequest } from '@vercel/node';

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

export const consumeRateLimit = ({
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
