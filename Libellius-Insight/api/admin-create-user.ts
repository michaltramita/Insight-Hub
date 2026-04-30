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

    const { data: actorProfile, error: actorProfileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .single();

    if (actorProfileError || actorProfile?.role !== 'admin') {
      return sendError(res, 403, 'Na vytvorenie používateľa nemáte oprávnenie.');
    }

    let resolvedOrganizationId = organizationId;
    if (resolvedOrganizationId) {
      const { data: organization, error: organizationError } = await adminClient
        .from('organizations')
        .select('id')
        .eq('id', resolvedOrganizationId)
        .single();

      if (organizationError || !organization) {
        return sendError(res, 400, 'Vybraná organizácia neexistuje.');
      }
    } else {
      const { data: defaultOrganization } = await adminClient
        .from('organizations')
        .select('id')
        .eq('slug', 'libellius')
        .single();
      resolvedOrganizationId = defaultOrganization?.id || null;
    }

    if (moduleCodes.length > 0) {
      const { data: modules, error: modulesError } = await adminClient
        .from('modules')
        .select('code')
        .in('code', moduleCodes)
        .eq('is_active', true);

      const validCodes = new Set((modules || []).map((module) => module.code));
      if (
        modulesError ||
        moduleCodes.some((moduleCode) => !validCodes.has(moduleCode))
      ) {
        return sendError(res, 400, 'Požiadavka obsahuje neplatný modul.');
      }
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

    const { error: profileError } = await adminClient.from('profiles').upsert(
      {
        id: userId,
        email,
        full_name: fullName || null,
        company_name: companyName || null,
        role: 'participant',
        organization_id: resolvedOrganizationId,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      return sendError(
        res,
        500,
        readApiError(profileError, 'Profil používateľa sa nepodarilo uložiť.')
      );
    }

    if (moduleCodes.length > 0) {
      const assignmentRows = moduleCodes.map((moduleCode) => ({
        user_id: userId,
        organization_id: resolvedOrganizationId,
        module_code: moduleCode,
        status: 'active',
        assigned_by: authData.user.id,
      }));
      const { error: assignmentError } = await adminClient
        .from('module_assignments')
        .upsert(assignmentRows, { onConflict: 'user_id,module_code' });

      if (assignmentError) {
        return sendError(
          res,
          500,
          readApiError(assignmentError, 'Prístupy používateľa sa nepodarilo uložiť.')
        );
      }
    }

    await adminClient.from('admin_audit_log').insert({
      actor_id: authData.user.id,
      action: 'admin_create_user',
      target_user_id: userId,
      details: {
        email,
        organization_id: resolvedOrganizationId,
        module_codes: moduleCodes,
      },
    });

    return res.status(201).json({ userId });
  } catch (error: unknown) {
    console.error('admin-create-user error:', error);
    return sendError(res, 500, 'Používateľa sa nepodarilo vytvoriť.');
  }
}
