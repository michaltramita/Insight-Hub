import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import {
  buildShareBlobPath,
  generateShareId,
  sanitizePublicMeta,
  type StoredSharedReport,
} from './share-report-storage.js';
import { consumeRateLimit, getClientIp } from './rate-limit.js';

const MAX_REQUEST_BODY_BYTES = 350000;
const MAX_ENCRYPTED_PAYLOAD_LENGTH = 300000;
const CREATE_RATE_LIMIT = {
  limit: 20,
  windowMs: 60_000,
};

const readContentLength = (req: VercelRequest) => {
  const rawHeader = Array.isArray(req.headers['content-length'])
    ? req.headers['content-length'][0]
    : req.headers['content-length'];
  const parsed = Number(rawHeader);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const hasOversizedBody = (req: VercelRequest, maxBytes: number) => {
  const contentLength = readContentLength(req);
  if (contentLength !== null && contentLength > maxBytes) return true;

  try {
    const serialized = JSON.stringify(req.body ?? {});
    return Buffer.byteLength(serialized, 'utf8') > maxBytes;
  } catch {
    return true;
  }
};

const hasJsonContentType = (req: VercelRequest) => {
  const raw = Array.isArray(req.headers['content-type'])
    ? req.headers['content-type'][0]
    : req.headers['content-type'];
  return String(raw || '')
    .toLowerCase()
    .includes('application/json');
};

const isValidEncryptedPayload = (value: unknown) => {
  if (typeof value !== 'string') return false;
  const payload = value.trim();
  return (
    payload.length > 0 &&
    payload.length <= MAX_ENCRYPTED_PAYLOAD_LENGTH &&
    (payload.startsWith('v1.') ||
      payload.startsWith('v2.') ||
      payload.startsWith('v3.'))
  );
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  const rateLimit = consumeRateLimit({
    bucket: `share-create:${clientIp}`,
    limit: CREATE_RATE_LIMIT.limit,
    windowMs: CREATE_RATE_LIMIT.windowMs,
  });
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res
      .status(429)
      .json({ error: 'Príliš veľa požiadaviek. Skúste to znova o chvíľu.' });
  }

  if (!hasJsonContentType(req)) {
    return res.status(415).json({ error: 'Očakáva sa Content-Type: application/json.' });
  }

  if (hasOversizedBody(req, MAX_REQUEST_BODY_BYTES)) {
    return res.status(413).json({ error: 'Požiadavka je príliš veľká.' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store');

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'Chýba konfigurácia pre Vercel Blob.',
      });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Neplatné telo požiadavky.' });
    }

    const { encryptedPayload, publicMeta } = req.body as Record<string, unknown>;

    if (
      publicMeta !== undefined &&
      publicMeta !== null &&
      (typeof publicMeta !== 'object' || Array.isArray(publicMeta))
    ) {
      return res.status(400).json({ error: 'Neplatné verejné metadáta.' });
    }

    if (!isValidEncryptedPayload(encryptedPayload)) {
      return res.status(400).json({ error: 'Neplatný šifrovaný payload reportu.' });
    }

    const shareId = generateShareId();
    const pathname = buildShareBlobPath(shareId);

    const body: StoredSharedReport = {
      encryptedPayload: String(encryptedPayload).trim(),
      publicMeta: sanitizePublicMeta(publicMeta),
      createdAt: new Date().toISOString(),
    };

    await put(pathname, JSON.stringify(body), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });

    return res.status(201).json({ shareId });
  } catch (error: any) {
    console.error('share-report-create error:', error);
    return res.status(500).json({
      error: 'Nepodarilo sa vytvoriť zdieľaný odkaz.',
    });
  }
}
