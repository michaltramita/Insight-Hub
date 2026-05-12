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

const sendError = (res: VercelResponse, status: number, error: string) =>
  res.status(status).json({ error });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  const token = readBearerToken(req);
  if (!token) {
    return sendError(res, 401, 'Pre odstránenie organizácie sa prihláste ako admin.');
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

  const organizationId = normalizeText(req.body.organizationId);
  if (!organizationId || !UUID_PATTERN.test(organizationId)) {
    return sendError(res, 400, 'Chýba platné ID organizácie.');
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
      return sendError(res, 401, 'Pre odstránenie organizácie sa prihláste ako admin.');
    }

    const { data: isAdmin, error: adminCheckError } =
      await userScopedClient.rpc('is_global_admin');
    if (adminCheckError || isAdmin !== true) {
      return sendError(res, 403, 'Na odstránenie organizácie nemáte oprávnenie.');
    }

    const { data: organization, error: organizationError } = await adminClient
      .from('organizations')
      .select('id, name, slug')
      .eq('id', organizationId)
      .maybeSingle();

    if (organizationError) {
      return sendError(res, 500, 'Organizáciu sa nepodarilo overiť.');
    }
    if (!organization) {
      return sendError(res, 404, 'Organizácia nebola nájdená.');
    }

    const [profilesResult, projectsResult, testsResult] = await Promise.all([
        adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        adminClient
          .from('company_projects')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        adminClient
          .from('typology_tests')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
      ]);

    if (profilesResult.error || projectsResult.error || testsResult.error) {
      return sendError(res, 500, 'Organizáciu sa nepodarilo odstrániť.');
    }

    const linkedProfiles = profilesResult.count || 0;
    const linkedProjects = projectsResult.count || 0;
    const linkedTests = testsResult.count || 0;

    if (linkedProfiles > 0 || linkedProjects > 0 || linkedTests > 0) {
      return sendError(
        res,
        409,
        `Organizáciu nie je možné odstrániť. Najprv presuňte alebo vyčistite naviazané dáta (používatelia: ${linkedProfiles}, projekty: ${linkedProjects}, testy: ${linkedTests}).`
      );
    }

    const { error: deleteError } = await adminClient
      .from('organizations')
      .delete()
      .eq('id', organizationId);

    if (deleteError) {
      return sendError(res, 500, 'Organizáciu sa nepodarilo odstrániť.');
    }

    const { error: auditError } = await adminClient.from('admin_audit_log').insert({
      actor_id: authData.user.id,
      action: 'admin_delete_organization',
      target_user_id: null,
      details: {
        organization_id: organization.id,
        organization_name: organization.name,
        organization_slug: organization.slug,
      },
    });

    if (auditError) {
      console.warn('admin-delete-organization audit log failed:', auditError);
    }

    return res.status(200).json({ organizationId: organization.id });
  } catch (error: unknown) {
    console.error('admin-delete-organization error:', error);
    return sendError(res, 500, 'Organizáciu sa nepodarilo odstrániť.');
  }
}
