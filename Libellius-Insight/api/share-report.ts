import type { VercelRequest, VercelResponse } from './_vercel-types.js';
import createHandler from './_share-report-create.js';
import deleteHandler from './_share-report-delete.js';
import getHandler from './_share-report-get.js';

const isDeleteRequest = (body: unknown) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const payload = body as Record<string, unknown>;
  return (
    payload.action === 'delete' ||
    (typeof payload.shareId === 'string' && typeof payload.encryptedPayload !== 'string')
  );
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return getHandler(req, res);
  }

  if (req.method === 'POST') {
    return isDeleteRequest(req.body) ? deleteHandler(req, res) : createHandler(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
