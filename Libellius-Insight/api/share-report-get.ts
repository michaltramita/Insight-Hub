import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import {
  buildShareBlobPath,
  isValidShareId,
  sanitizePublicMeta,
} from './share-report-storage';

const isValidEncryptedPayload = (value: unknown) => {
  const payload = String(value || '').trim();
  return (
    payload.length > 0 &&
    payload.length <= 300000 &&
    (payload.startsWith('v1.') ||
      payload.startsWith('v2.') ||
      payload.startsWith('v3.'))
  );
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'Chýba konfigurácia pre Vercel Blob.',
        details:
          'Premenná BLOB_READ_WRITE_TOKEN nie je dostupná v runtime. Skontrolujte Environment Variables a spravte nový deploy.',
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
      details:
        error?.message ||
        'Skontrolujte, či je Vercel Blob store vytvorený a pripojený k tomuto projektu.',
    });
  }
}
