import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from './vercel-types.js';
import {
  enforceAdminIpRateLimit,
  enforceAdminUserRateLimit,
} from './admin-rate-limit.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_RATE_LIMIT = {
  endpoint: 'delete-project',
  limit: 20,
  windowMs: 60_000,
};

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

const sendError = (res: VercelResponse, status: number, error: string) =>
  res.status(status).json({ error });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }
  if (!(await enforceAdminIpRateLimit(req, res, ADMIN_RATE_LIMIT))) return;

  const token = readBearerToken(req);
  if (!token) {
    return sendError(res, 401, 'Pre odstránenie projektu sa prihláste ako admin.');
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

  const projectId = normalizeText(req.body.projectId);
  if (!projectId || !UUID_PATTERN.test(projectId)) {
    return sendError(res, 400, 'Chýba platné ID projektu.');
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
      return sendError(res, 401, 'Pre odstránenie projektu sa prihláste ako admin.');
    }

    const { data: isAdmin, error: adminCheckError } =
      await userScopedClient.rpc('is_global_admin');
    if (adminCheckError || isAdmin !== true) {
      return sendError(res, 403, 'Na odstránenie projektu nemáte oprávnenie.');
    }
    if (
      !(await enforceAdminUserRateLimit(res, {
        ...ADMIN_RATE_LIMIT,
        userId: authData.user.id,
      }))
    ) {
      return;
    }

    const { data: project, error: projectError } = await adminClient
      .from('company_projects')
      .select('id, name, company_name')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError) {
      return sendError(res, 500, 'Projekt sa nepodarilo overiť.');
    }
    if (!project) {
      return sendError(res, 404, 'Projekt nebol nájdený.');
    }

    const { error: deleteError } = await adminClient
      .from('company_projects')
      .delete()
      .eq('id', projectId);

    if (deleteError) {
      return sendError(res, 500, 'Projekt sa nepodarilo odstrániť.');
    }

    const { error: auditError } = await adminClient.from('admin_audit_log').insert({
      actor_id: authData.user.id,
      action: 'admin_delete_company_project',
      target_user_id: null,
      details: {
        project_id: project.id,
        project_name: project.name,
        company_name: project.company_name,
      },
    });

    if (auditError) {
      console.warn('admin-delete-project audit log failed:', auditError);
    }

    return res.status(200).json({ projectId: project.id });
  } catch (error: unknown) {
    console.error('admin-delete-project error:', error);
    return sendError(res, 500, 'Projekt sa nepodarilo odstrániť.');
  }
}
