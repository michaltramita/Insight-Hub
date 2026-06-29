import type { VercelRequest, VercelResponse } from './_vercel-types.js';
import { consumeRateLimit, getClientIp } from './_rate-limit.js';

const ADMIN_RATE_LIMIT_MESSAGE =
  'Príliš veľa administrátorských požiadaviek. Skúste to znova o chvíľu.';

type AdminRateLimitOptions = {
  endpoint: string;
  limit: number;
  windowMs: number;
};

const sendRateLimitError = (
  res: VercelResponse,
  retryAfterSeconds: number
) => {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({ error: ADMIN_RATE_LIMIT_MESSAGE });
};

export const enforceAdminIpRateLimit = async (
  req: VercelRequest,
  res: VercelResponse,
  options: AdminRateLimitOptions
) => {
  const clientIp = getClientIp(req);
  const rateLimit = await consumeRateLimit({
    bucket: `admin-${options.endpoint}:${clientIp}`,
    limit: options.limit,
    windowMs: options.windowMs,
  });

  if (!rateLimit.allowed) {
    sendRateLimitError(res, rateLimit.retryAfterSeconds);
    return false;
  }

  return true;
};

export const enforceAdminUserRateLimit = async (
  res: VercelResponse,
  options: AdminRateLimitOptions & { userId: string }
) => {
  const rateLimit = await consumeRateLimit({
    bucket: `admin-${options.endpoint}:user:${options.userId}`,
    limit: options.limit,
    windowMs: options.windowMs,
  });

  if (!rateLimit.allowed) {
    sendRateLimitError(res, rateLimit.retryAfterSeconds);
    return false;
  }

  return true;
};
