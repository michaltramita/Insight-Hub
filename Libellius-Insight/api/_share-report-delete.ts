import { del, get } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from './_vercel-types.js';
import {
  buildShareBlobPath,
  isValidShareId,
  type StoredSharedReport,
} from './_share-report-storage.js';
import { consumeRateLimit, getClientIp } from './_rate-limit.js';
import { isGlobalAdminRequest, requireAuthenticatedUser } from './_authHelpers.js';

const MAX_STORED_REPORT_BYTES = 350000;
const DELETE_RATE_LIMIT = {
  limit: 20,
  windowMs: 60_000,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  const rateLimit = await consumeRateLimit({
    bucket: `revoke-share:${clientIp}`,
    limit: DELETE_RATE_LIMIT.limit,
    windowMs: DELETE_RATE_LIMIT.windowMs,
  });
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res
      .status(429)
      .json({ error: 'Príliš veľa požiadaviek. Skúste to znova o chvíľu.' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store');

    const authUser = await requireAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({
        error: 'Pre zrušenie zdieľaného odkazu sa prihláste.',
      });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'Chýba konfigurácia pre Vercel Blob.',
      });
    }

    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Neplatné telo požiadavky.' });
    }

    const shareId = String(req.body.shareId || '').trim();
    if (!isValidShareId(shareId)) {
      return res.status(400).json({ error: 'Neplatné ID zdieľania.' });
    }

    const pathname = buildShareBlobPath(shareId);
    const blob = await get(pathname, { access: 'private' });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return res.status(404).json({ error: 'Zdieľaný report nebol nájdený.' });
    }

    const payloadText = await new Response(blob.stream).text();
    if (Buffer.byteLength(payloadText, 'utf8') > MAX_STORED_REPORT_BYTES) {
      return res.status(422).json({ error: 'Zdieľaný report je príliš veľký.' });
    }

    const parsed = JSON.parse(payloadText) as Partial<StoredSharedReport>;
    const isOwner = parsed.ownerUserId === authUser.id;
    const isAdmin = isOwner ? false : await isGlobalAdminRequest(req);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Na zrušenie tohto zdieľaného odkazu nemáte oprávnenie.',
      });
    }

    await del(pathname);

    return res.status(200).json({ shareId });
  } catch (error: unknown) {
    console.error('share-report-delete error:', error);
    return res.status(500).json({
      error: 'Zdieľaný odkaz sa nepodarilo zrušiť.',
    });
  }
}
