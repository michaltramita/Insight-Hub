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

export type AdminTypologyTest = {
  id: string;
  title: string;
  status: string;
  participantResultsAvailableAt: string | null;
};

export type CompanyProjectStatus = "active" | "completed" | "archived";

export type CompanyProject = {
  id: string;
  name: string;
  companyName: string;
  description: string | null;
  contactPersonName: string | null;
  contactPersonEmail: string | null;
  status: CompanyProjectStatus;
  organizationId: string | null;
  moduleCodes: AppModuleCode[];
  resultAccessDate: string | null;
  createdAt: string;
  updatedAt: string;
  participantIds: string[];
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
  typologyTests: AdminTypologyTest[];
  projects: CompanyProject[];
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
  projectId?: string | null;
};

export type AdminResetUserPasswordInput = {
  userId: string;
  password: string;
};

export type AdminCreateOrganizationInput = {
  name: string;
};

export type AdminDeleteUserInput = {
  userId: string;
};

export type AdminDeleteProjectInput = {
  projectId: string;
};

export type AdminDeleteOrganizationInput = {
  organizationId: string;
};

export type CompanyProjectFormInput = {
  name: string;
  companyName: string;
  description: string;
  contactPersonName: string;
  contactPersonEmail: string;
  status: CompanyProjectStatus;
  organizationId: string | null;
  moduleCodes: AppModuleCode[];
  resultAccessDate: string | null;
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

type AdminTypologyTestRow = {
  id: string;
  title: string;
  status: string;
  participant_results_available_at: string | null;
};

type CompanyProjectRow = {
  id: string;
  name: string;
  company_name: string;
  description: string | null;
  contact_person_name: string | null;
  contact_person_email: string | null;
  status: CompanyProjectStatus;
  organization_id: string | null;
  module_codes: AppModuleCode[] | null;
  result_access_date: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyProjectParticipantRow = {
  project_id: string;
  user_id: string;
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

const isMissingProjectsTableError = (error: unknown) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "").toLowerCase()
      : "";

  return (
    message.includes("company_projects") ||
    message.includes("company_project_participants") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
};

const normalizeNullableText = (value: string) => value.trim() || null;

const assertProjectInput = (input: CompanyProjectFormInput) => {
  if (!input.name.trim()) {
    throw new Error("Zadajte názov projektu.");
  }
  if (!input.companyName.trim()) {
    throw new Error("Zadajte názov firmy.");
  }
  if (
    input.contactPersonEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactPersonEmail.trim())
  ) {
    throw new Error("Zadajte platný kontaktný email.");
  }
};

const loadCompanyProjects = async (): Promise<CompanyProject[]> => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const [projectsResult, participantsResult] = await Promise.all([
    db
      .from("company_projects")
      .select(
        "id, name, company_name, description, contact_person_name, contact_person_email, status, organization_id, module_codes, result_access_date, created_at, updated_at"
      )
      .order("created_at", { ascending: false }),
    db
      .from("company_project_participants")
      .select("project_id, user_id")
      .order("added_at", { ascending: true }),
  ]);

  if (projectsResult.error || participantsResult.error) {
    const error = projectsResult.error || participantsResult.error;
    if (isMissingProjectsTableError(error)) {
      return [];
    }
    throw new Error(error.message);
  }

  const participantIdsByProject = new Map<string, string[]>();
  for (const row of (participantsResult.data || []) as CompanyProjectParticipantRow[]) {
    const current = participantIdsByProject.get(row.project_id) || [];
    current.push(row.user_id);
    participantIdsByProject.set(row.project_id, current);
  }

  return ((projectsResult.data || []) as CompanyProjectRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    companyName: row.company_name,
    description: row.description,
    contactPersonName: row.contact_person_name,
    contactPersonEmail: row.contact_person_email,
    status: row.status,
    organizationId: row.organization_id,
    moduleCodes: row.module_codes || [],
    resultAccessDate: row.result_access_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participantIds: participantIdsByProject.get(row.id) || [],
  }));
};

export const loadAdminAccessOverview = async (): Promise<AdminAccessOverview> => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const [
    usersResult,
    organizationsResult,
    modulesResult,
    typologyTestsResult,
    projects,
  ] =
    await Promise.all([
      db.rpc("admin_list_users"),
      supabase.from("organizations").select("id, name, slug").order("name"),
      supabase
        .from("modules")
        .select("code, title, description, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("typology_tests")
        .select("id, title, status, participant_results_available_at")
        .order("created_at", { ascending: true }),
      loadCompanyProjects(),
    ]);

  if (usersResult.error) throw new Error(usersResult.error.message);
  if (organizationsResult.error) throw new Error(organizationsResult.error.message);
  if (modulesResult.error) throw new Error(modulesResult.error.message);
  if (typologyTestsResult.error) throw new Error(typologyTestsResult.error.message);

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
    typologyTests: ((typologyTestsResult.data || []) as AdminTypologyTestRow[]).map(
      (row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        participantResultsAvailableAt: row.participant_results_available_at,
      })
    ),
    projects,
  };
};

export const createCompanyProject = async (input: CompanyProjectFormInput) => {
  assertProjectInput(input);

  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { data: sessionData } = await supabase.auth.getSession();

  const { data, error } = await db
    .from("company_projects")
    .insert({
      name: input.name.trim(),
      company_name: input.companyName.trim(),
      description: normalizeNullableText(input.description),
      contact_person_name: normalizeNullableText(input.contactPersonName),
      contact_person_email: normalizeNullableText(input.contactPersonEmail),
      status: input.status,
      organization_id: input.organizationId,
      module_codes: input.moduleCodes,
      result_access_date: input.resultAccessDate,
      created_by: sessionData.session?.user.id || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { projectId: data?.id as string };
};

export const updateCompanyProject = async (
  projectId: string,
  input: CompanyProjectFormInput
) => {
  assertProjectInput(input);

  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { error } = await db
    .from("company_projects")
    .update({
      name: input.name.trim(),
      company_name: input.companyName.trim(),
      description: normalizeNullableText(input.description),
      contact_person_name: normalizeNullableText(input.contactPersonName),
      contact_person_email: normalizeNullableText(input.contactPersonEmail),
      status: input.status,
      organization_id: input.organizationId,
      module_codes: input.moduleCodes,
      result_access_date: input.resultAccessDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
};

export const archiveCompanyProject = async (projectId: string) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { error } = await db
    .from("company_projects")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
};

export const addCompanyProjectParticipant = async (
  projectId: string,
  userId: string
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { error } = await db.rpc("admin_assign_project_participant", {
    p_project_id: projectId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const removeCompanyProjectParticipant = async (
  projectId: string,
  userId: string
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { error } = await db.rpc("admin_remove_project_participant", {
    p_project_id: projectId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const updateCompanyProjectResultAccessDate = async (
  projectId: string,
  resultAccessDate: string | null
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { error } = await db
    .from("company_projects")
    .update({
      result_access_date: resultAccessDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
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
    const message = String(error.message || "");
    if (message.includes("admin_organization_required_for_modules")) {
      throw new Error("Pre priradenie modulov vyberte organizáciu používateľa.");
    }
    if (message.includes("admin_invalid_organization")) {
      throw new Error("Vybraná organizácia neexistuje.");
    }
    if (message.includes("admin_invalid_module")) {
      throw new Error("Vybraný modul nie je aktívny alebo chýba v databáze.");
    }
    throw new Error(message || "Prístupy používateľa sa nepodarilo uložiť.");
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

export const updateAdminTypologyResultRelease = async (
  testId: string,
  participantResultsAvailableAt: string | null
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { error } = await db
    .from("typology_tests")
    .update({
      participant_results_available_at: participantResultsAvailableAt,
    })
    .eq("id", testId);

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

export const createAdminOrganization = async (
  input: AdminCreateOrganizationInput
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const { error } = await db.rpc("admin_create_organization", {
    p_name: input.name,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("admin_access_denied")) {
      throw new Error("Na vytvorenie organizácie nemáte oprávnenie.");
    }
    if (message.includes("admin_organization_name_required")) {
      throw new Error("Zadajte názov organizácie.");
    }
    throw new Error("Organizáciu sa nepodarilo vytvoriť.");
  }
};

export const deleteAdminUser = async (input: AdminDeleteUserInput) => {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Pre odstránenie používateľa sa prihláste ako admin.");
  }

  const response = await fetch("/api/admin-delete-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Používateľa sa nepodarilo odstrániť.")
    );
  }
};

export const deleteCompanyProject = async (input: AdminDeleteProjectInput) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { error } = await db
    .from("company_projects")
    .delete()
    .eq("id", input.projectId);

  if (error) {
    throw new Error(error.message || "Projekt sa nepodarilo odstrániť.");
  }
};

export const deleteAdminOrganization = async (
  input: AdminDeleteOrganizationInput
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const { error } = await db.rpc("admin_delete_organization", {
    p_organization_id: input.organizationId,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("admin_access_denied")) {
      throw new Error("Na odstránenie organizácie nemáte oprávnenie.");
    }
    if (message.includes("admin_organization_not_found")) {
      throw new Error("Organizácia nebola nájdená.");
    }
    const dependencyMatch = message.match(
      /admin_organization_has_dependencies:(\d+):(\d+):(\d+)/
    );
    if (dependencyMatch) {
      const [, profiles, projects, tests] = dependencyMatch;
      throw new Error(
        `Organizáciu nie je možné odstrániť. Najprv presuňte alebo vyčistite naviazané dáta (používatelia: ${profiles}, projekty: ${projects}, testy: ${tests}).`
      );
    }
    throw new Error("Organizáciu sa nepodarilo odstrániť.");
  }
};

export const resetAdminUserPassword = async (
  input: AdminResetUserPasswordInput
) => {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Pre reset hesla sa prihláste ako admin.");
  }

  const response = await fetch("/api/admin-reset-user-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Heslo používateľa sa nepodarilo resetovať.")
    );
  }

  const parsed = (await response.json()) as { userId?: string; email?: string | null };
  if (!parsed.userId) {
    throw new Error("Server nevrátil ID používateľa s resetovaným heslom.");
  }
  return parsed;
};
