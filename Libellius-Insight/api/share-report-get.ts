import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import {
  buildShareBlobPath,
  isValidShareId,
  sanitizePublicMeta,
} from './share-report-storage.js';
import { consumeRateLimit, getClientIp } from './rate-limit.js';

const MAX_RESPONSE_BODY_BYTES = 350000;
const MAX_ENCRYPTED_PAYLOAD_LENGTH = 300000;
const GET_RATE_LIMIT = {
  limit: 120,
  windowMs: 60_000,
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  const rateLimit = await consumeRateLimit({
    bucket: `share-get:${clientIp}`,
    limit: GET_RATE_LIMIT.limit,
    windowMs: GET_RATE_LIMIT.windowMs,
  });
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res
      .status(429)
      .json({ error: 'Príliš veľa požiadaviek. Skúste to znova o chvíľu.' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store');

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'Chýba konfigurácia pre Vercel Blob.',
      });
    }

    const rawShareId = Array.isArray(req.query.id)
      ? req.query.id[0]
      : req.query.id;
    const shareId = String(rawShareId || '').trim();

    if (!isValidShareId(shareId)) {
      return res.status(400).json({ error: 'Neplatné ID zdieľania.' });
    }

    const pathname = buildShareBlobPath(shareId);
    const blob = await get(pathname, { access: 'private' });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return res.status(404).json({ error: 'Zdieľaný report nebol nájdený.' });
    }

    const payloadText = await new Response(blob.stream).text();
    if (Buffer.byteLength(payloadText, 'utf8') > MAX_RESPONSE_BODY_BYTES) {
      return res.status(422).json({ error: 'Zdieľaný report je príliš veľký.' });
    }

    const parsed = JSON.parse(payloadText) as {
      encryptedPayload?: string;
      publicMeta?: unknown;
    };

    if (!isValidEncryptedPayload(parsed?.encryptedPayload)) {
      return res.status(422).json({ error: 'Zdieľaný report je poškodený.' });
    }

    return res.status(200).json({
      encryptedPayload: String(parsed.encryptedPayload).trim(),
      publicMeta: sanitizePublicMeta(parsed.publicMeta),
    });
  } catch (error: any) {
    console.error('share-report-get error:', error);
    return res.status(500).json({
      error: 'Link reportu sa nepodarilo načítať.',
    });
  }
}
