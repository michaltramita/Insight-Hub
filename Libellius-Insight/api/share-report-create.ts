import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import {
  buildShareBlobPath,
  generateShareId,
  sanitizePublicMeta,
  type StoredSharedReport,
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
  if (req.method !== 'POST') {
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

    const { encryptedPayload, publicMeta } = req.body || {};

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
      details:
        error?.message ||
        'Skontrolujte, či je Vercel Blob store vytvorený a pripojený k tomuto projektu.',
    });
  }
}
