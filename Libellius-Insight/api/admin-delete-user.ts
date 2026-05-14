import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from './vercel-types.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readSupabaseApiConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
});

const readBearerToken = (req: VercelRequest) => {
  const rawHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const match = String(rawHeader || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const readApiError = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    return message || fallback;
  }
  return fallback;
};

const readUserMetadataText = (
  metadata: unknown,
  key: string
) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '';
  }
  return normalizeText((metadata as Record<string, unknown>)[key]);
};

const sendError = (res: VercelResponse, status: number, error: string) =>
  res.status(status).json({ error });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  const token = readBearerToken(req);
  if (!token) {
    return sendError(res, 401, 'Pre odstránenie používateľa sa prihláste ako admin.');
  }

  const { url, anonKey, serviceRoleKey } = readSupabaseApiConfig();
  if (!url || !anonKey) {
    return sendError(res, 500, 'Supabase Auth nie je nakonfigurovaný pre API endpoint.');
  }
  if (!serviceRoleKey) {
    return sendError(res, 500, 'Chýba konfigurácia administrátorského API.');
  }

  if (!isPlainObject(req.body)) {
    return sendError(res, 400, 'Neplatné telo požiadavky.');
  }

  const userId = normalizeText(req.body.userId);
  if (!userId || !UUID_PATTERN.test(userId)) {
    return sendError(res, 400, 'Chýba platné ID používateľa.');
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userScopedClient = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return sendError(res, 401, 'Pre odstránenie používateľa sa prihláste ako admin.');
    }

    if (authData.user.id === userId) {
      return sendError(res, 400, 'Vlastné konto nie je možné odstrániť.');
    }

    const { data: isAdmin, error: adminCheckError } =
      await userScopedClient.rpc('is_global_admin');
    if (adminCheckError || isAdmin !== true) {
      return sendError(res, 403, 'Na odstránenie používateľa nemáte oprávnenie.');
    }

    const { data: targetUserData, error: targetUserError } =
      await adminClient.auth.admin.getUserById(userId);

    if (targetUserError) {
      const message = readApiError(
        targetUserError,
        'Používateľa sa nepodarilo overiť.'
      );
      const status = message.toLowerCase().includes('not found') ? 404 : 500;
      return sendError(res, status, message);
    }
    if (!targetUserData.user) {
      return sendError(res, 404, 'Používateľ nebol nájdený.');
    }

    const targetEmail =
      typeof targetUserData.user.email === 'string'
        ? targetUserData.user.email
        : null;
    const targetFullName =
      readUserMetadataText(targetUserData.user.user_metadata, 'full_name') || null;

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      const message = readApiError(
        deleteError,
        'Používateľa sa nepodarilo odstrániť.'
      );
      return sendError(
        res,
        message.toLowerCase().includes('not found') ? 404 : 500,
        message
      );
    }

    const { error: auditError } = await adminClient.from('admin_audit_log').insert({
      actor_id: authData.user.id,
      action: 'admin_delete_user',
      target_user_id: null,
      details: {
        user_id: userId,
        email: targetEmail,
        full_name: targetFullName,
      },
    });

    if (auditError) {
      console.warn('admin-delete-user audit log failed:', auditError);
    }

    return res.status(200).json({ userId });
  } catch (error: unknown) {
    console.error('admin-delete-user error:', error);
    return sendError(res, 500, 'Používateľa sa nepodarilo odstrániť.');
  }
}
