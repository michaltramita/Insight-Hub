import { randomBytes } from 'crypto';

export interface StoredSharedReport {
  encryptedPayload: string;
  publicMeta: {
    client?: string;
    survey?: string;
    issued?: string;
  };
  createdAt: string;
}

export const buildShareBlobPath = (shareId: string) =>
  `shared-reports/${shareId}.json`;

export const generateShareId = () => randomBytes(9).toString('base64url');

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
