import { getSupabaseBrowserClient } from "../lib/supabase";
import type { AppModuleCode, AppUserRole } from "./accessControl";

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type AdminModule = {
  code: AppModuleCode;
  title: string;
  description: string;
  sortOrder: number;
};

export type AdminManagedUser = {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  role: AppUserRole;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  moduleCodes: AppModuleCode[];
  typologyStatus: string | null;
  typologyCompletedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type AdminAccessOverview = {
  users: AdminManagedUser[];
  organizations: AdminOrganization[];
  modules: AdminModule[];
};

export type AdminUserAccessUpdate = {
  userId: string;
  fullName: string;
  companyName: string;
  role: AppUserRole;
  organizationId: string | null;
  moduleCodes: AppModuleCode[];
};

export type AdminCreateUserInput = {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  organizationId: string | null;
  moduleCodes: AppModuleCode[];
};

type AdminManagedUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: AppUserRole;
  organization_id: string | null;
  organization_name: string | null;
  organization_slug: string | null;
  module_codes: AppModuleCode[] | null;
  typology_status: string | null;
  typology_completed_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type AdminOrganizationRow = {
  id: string;
  name: string;
  slug: string;
};

type AdminModuleRow = {
  code: AppModuleCode;
  title: string;
  description: string;
  sort_order: number;
};

const readApiError = async (response: Response, fallbackMessage: string) => {
  try {
    const parsed = await response.json();
    if (parsed?.error && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Použijeme fallback.
  }
  return fallbackMessage;
};

export const loadAdminAccessOverview = async (): Promise<AdminAccessOverview> => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const [usersResult, organizationsResult, modulesResult] = await Promise.all([
    db.rpc("admin_list_users"),
    supabase.from("organizations").select("id, name, slug").order("name"),
    supabase
      .from("modules")
      .select("code, title, description, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (usersResult.error) throw new Error(usersResult.error.message);
  if (organizationsResult.error) throw new Error(organizationsResult.error.message);
  if (modulesResult.error) throw new Error(modulesResult.error.message);

  return {
    users: ((usersResult.data || []) as AdminManagedUserRow[]).map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      companyName: row.company_name,
      role: row.role,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationSlug: row.organization_slug,
      moduleCodes: row.module_codes || [],
      typologyStatus: row.typology_status,
      typologyCompletedAt: row.typology_completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    organizations: ((organizationsResult.data || []) as AdminOrganizationRow[]).map(
      (row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
      })
    ),
    modules: ((modulesResult.data || []) as AdminModuleRow[]).map((row) => ({
      code: row.code,
      title: row.title,
      description: row.description,
      sortOrder: row.sort_order,
    })),
  };
};

export const updateAdminUserAccess = async (input: AdminUserAccessUpdate) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const { error } = await db.rpc("admin_update_user_access", {
    p_user_id: input.userId,
    p_full_name: input.fullName,
    p_company_name: input.companyName,
    p_role: input.role,
    p_organization_id: input.organizationId,
    p_module_codes: input.moduleCodes,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const resetAdminTypologySession = async (userId: string) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const { error } = await db.rpc("admin_reset_typology_session", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const createAdminUser = async (input: AdminCreateUserInput) => {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Pre vytvorenie používateľa sa prihláste ako admin.");
  }

  const response = await fetch("/api/admin-create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Používateľa sa nepodarilo vytvoriť.")
    );
  }

  const parsed = (await response.json()) as { userId?: string };
  if (!parsed.userId) {
    throw new Error("Server nevrátil ID vytvoreného používateľa.");
  }
  return parsed;
};
