import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from './_vercel-types.js';
import {
  enforceAdminIpRateLimit,
  enforceAdminUserRateLimit,
} from './_admin-rate-limit.js';

const MIN_PASSWORD_LENGTH = 8;
const ADMIN_RATE_LIMIT = {
  endpoint: 'reset-user-password',
  limit: 5,
  windowMs: 60_000,
};
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

const sendError = (res: VercelResponse, status: number, error: string) =>
  res.status(status).json({ error });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }
  if (!(await enforceAdminIpRateLimit(req, res, ADMIN_RATE_LIMIT))) return;

  const token = readBearerToken(req);
  if (!token) {
    return sendError(res, 401, 'Pre reset hesla sa prihláste ako admin.');
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
  const password = normalizeText(req.body.password);

  if (!userId || !UUID_PATTERN.test(userId)) {
    return sendError(res, 400, 'Chýba platné ID používateľa.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return sendError(res, 400, 'Nové heslo musí mať aspoň 8 znakov.');
  }

  const authClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const userScopedClient = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return sendError(res, 401, 'Pre reset hesla sa prihláste ako admin.');
    }

    if (authData.user.id === userId) {
      return sendError(
        res,
        400,
        'Vlastné heslo si zmeníte v používateľskom menu.'
      );
    }

    const { data: isAdmin, error: adminCheckError } =
      await userScopedClient.rpc('is_global_admin');

    if (adminCheckError || isAdmin !== true) {
      return sendError(res, 403, 'Na reset hesla nemáte oprávnenie.');
    }
    if (
      !(await enforceAdminUserRateLimit(res, {
        ...ADMIN_RATE_LIMIT,
        userId: authData.user.id,
      }))
    ) {
      return;
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

    const { data: updatedUser, error: updateError } =
      await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });

    if (updateError || !updatedUser.user) {
      const message = readApiError(
        updateError,
        'Heslo používateľa sa nepodarilo resetovať.'
      );
      const status = message.toLowerCase().includes('not found') ? 404 : 500;
      return sendError(res, status, message);
    }

    const { error: auditError } = await adminClient
      .from('admin_audit_log')
      .insert({
        actor_id: authData.user.id,
        action: 'admin_reset_user_password',
        target_user_id: userId,
        details: {
          email:
            typeof targetUserData.user.email === 'string'
              ? targetUserData.user.email
              : null,
        },
      });

    if (auditError) {
      console.warn('admin-reset-user-password audit log failed:', auditError);
    }

    return res.status(200).json({
      userId: updatedUser.user.id,
      email:
        typeof updatedUser.user.email === 'string'
          ? updatedUser.user.email
          : null,
    });
  } catch (error: unknown) {
    console.error('admin-reset-user-password error:', error);
    return sendError(res, 500, 'Heslo používateľa sa nepodarilo resetovať.');
  }
}
