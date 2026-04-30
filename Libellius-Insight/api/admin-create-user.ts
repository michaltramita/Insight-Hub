import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from './vercel-types.js';

const MODULE_CODES = [
  '360_FEEDBACK',
  'ZAMESTNANECKA_SPOKOJNOST',
  'TYPOLOGY_LEADERSHIP',
] as const;
type ModuleCode = (typeof MODULE_CODES)[number];

const MIN_PASSWORD_LENGTH = 8;

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

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeModuleCodes = (value: unknown): ModuleCode[] | null => {
  if (!Array.isArray(value)) return [];

  const selected = new Set<ModuleCode>();
  for (const item of value) {
    if (typeof item !== 'string' || !MODULE_CODES.includes(item as ModuleCode)) {
      return null;
    }
    selected.add(item as ModuleCode);
  }

  return Array.from(selected);
};

const readApiError = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    return message || fallback;
  }
  return fallback;
};

const mapAdminFinalizeError = (error: unknown) => {
  const message = readApiError(error, 'Profil používateľa sa nepodarilo uložiť.');
  const normalized = message.toLowerCase();

  if (normalized.includes('admin_access_denied')) {
    return {
      status: 403,
      error: 'Na vytvorenie používateľa nemáte oprávnenie.',
    };
  }
  if (normalized.includes('admin_invalid_organization')) {
    return { status: 400, error: 'Vybraná organizácia neexistuje.' };
  }
  if (normalized.includes('admin_invalid_module')) {
    return {
      status: 400,
      error: 'Vybraný modul nie je aktívny alebo chýba v databáze.',
    };
  }
  if (normalized.includes('duplicate') || normalized.includes('unique')) {
    return {
      status: 409,
      error: 'Používateľ alebo profil s týmto emailom už existuje.',
    };
  }

  return { status: 500, error: message };
};

const sendError = (res: VercelResponse, status: number, error: string) =>
  res.status(status).json({ error });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  const token = readBearerToken(req);
  if (!token) {
    return sendError(res, 401, 'Pre vytvorenie používateľa sa prihláste ako admin.');
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

  const email = normalizeText(req.body.email).toLowerCase();
  const password = normalizeText(req.body.password);
  const fullName = normalizeText(req.body.fullName);
  const companyName = normalizeText(req.body.companyName);
  const organizationId = normalizeText(req.body.organizationId) || null;
  const moduleCodes = normalizeModuleCodes(req.body.moduleCodes);

  if (!email || !isValidEmail(email)) {
    return sendError(res, 400, 'Zadajte platný email používateľa.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return sendError(res, 400, 'Dočasné heslo musí mať aspoň 8 znakov.');
  }
  if (moduleCodes === null) {
    return sendError(res, 400, 'Požiadavka obsahuje neplatný modul.');
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
      return sendError(res, 401, 'Pre vytvorenie používateľa sa prihláste ako admin.');
    }

    const { data: isAdmin, error: adminCheckError } =
      await userScopedClient.rpc('is_global_admin');

    if (adminCheckError || isAdmin !== true) {
      return sendError(res, 403, 'Na vytvorenie používateľa nemáte oprávnenie.');
    }

    const { data: createdUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      });

    if (createError || !createdUser.user) {
      const message = readApiError(createError, 'Používateľa sa nepodarilo vytvoriť.');
      const status = message.toLowerCase().includes('already') ? 409 : 500;
      return sendError(res, status, message);
    }

    const userId = createdUser.user.id;

    const { error: finalizeError } = await userScopedClient.rpc(
      'admin_finalize_created_user',
      {
        p_user_id: userId,
        p_email: email,
        p_full_name: fullName || null,
        p_company_name: companyName || null,
        p_organization_id: organizationId,
        p_module_codes: moduleCodes,
      }
    );

    if (finalizeError) {
      await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);
      const mappedError = mapAdminFinalizeError(finalizeError);
      return sendError(res, mappedError.status, mappedError.error);
    }

    return res.status(201).json({ userId });
  } catch (error: unknown) {
    console.error('admin-create-user error:', error);
    return sendError(res, 500, 'Používateľa sa nepodarilo vytvoriť.');
  }
}
