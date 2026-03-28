import { randomBytes } from 'crypto';

const DEFAULT_SHARE_LINK_TTL_DAYS = 30;
const MIN_SHARE_LINK_TTL_DAYS = 1;
const MAX_SHARE_LINK_TTL_DAYS = 365;

export interface StoredSharedReport {
  encryptedPayload: string;
  publicMeta: {
    client?: string;
    survey?: string;
    issued?: string;
  };
  createdAt: string;
  expiresAt?: string;
}

export const buildShareBlobPath = (shareId: string) =>
  `shared-reports/${shareId}.json`;

export const generateShareId = () => randomBytes(9).toString('base64url');

const resolveShareTtlDays = () => {
  const raw = Number(process.env.SHARE_LINK_TTL_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_SHARE_LINK_TTL_DAYS;
  const rounded = Math.floor(raw);
  if (rounded < MIN_SHARE_LINK_TTL_DAYS) return MIN_SHARE_LINK_TTL_DAYS;
  if (rounded > MAX_SHARE_LINK_TTL_DAYS) return MAX_SHARE_LINK_TTL_DAYS;
  return rounded;
};

const toTimestamp = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
};

const getShareTtlMs = () => resolveShareTtlDays() * 24 * 60 * 60 * 1000;

export const createShareTimestamps = (now = Date.now()) => {
  const ttlMs = getShareTtlMs();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();
  return { createdAt, expiresAt };
};

export const isShareExpired = (
  stored: Pick<StoredSharedReport, 'createdAt' | 'expiresAt'>,
  now = Date.now()
) => {
  const expiryTimestampFromField = toTimestamp(stored.expiresAt);
  if (expiryTimestampFromField !== null) {
    return now >= expiryTimestampFromField;
  }

  const createdTimestamp = toTimestamp(stored.createdAt);
  if (createdTimestamp === null) {
    return true;
  }

  return now >= createdTimestamp + getShareTtlMs();
};

const sanitizeMetaValue = (value: unknown) => {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized.slice(0, 200) : undefined;
};

export const sanitizePublicMeta = (meta: unknown) => {
  if (!meta || typeof meta !== 'object') {
    return {
      client: undefined,
      survey: undefined,
      issued: undefined,
    };
  }

  const parsed = meta as Record<string, unknown>;
  return {
    client: sanitizeMetaValue(parsed.client),
    survey: sanitizeMetaValue(parsed.survey),
    issued: sanitizeMetaValue(parsed.issued),
  };
};

export const isValidShareId = (value: string) =>
  /^[A-Za-z0-9_-]{8,64}$/.test(String(value || '').trim());
