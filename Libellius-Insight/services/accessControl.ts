import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "../lib/supabase";

export type AppModuleCode =
  | "360_FEEDBACK"
  | "ZAMESTNANECKA_SPOKOJNOST"
  | "TYPOLOGY_LEADERSHIP";

export type AppModuleAssignment = {
  code: AppModuleCode;
  title: string;
  description: string;
  sortOrder: number;
};

export type AppUserRole = "participant" | "manager" | "consultant" | "admin";

export type AppUserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  role: AppUserRole;
  organizationId: string | null;
};

type ModuleAssignmentRow = {
  module_code: AppModuleCode;
  modules:
    | {
        code: AppModuleCode;
        title: string;
        description: string;
        sort_order: number;
        is_active: boolean;
      }
    | null;
};

const isActiveInWindow = (startsAt?: string | null, endsAt?: string | null) => {
  const now = Date.now();
  const starts = startsAt ? Date.parse(startsAt) : null;
  const ends = endsAt ? Date.parse(endsAt) : null;

  return (
    (starts === null || Number.isNaN(starts) || starts <= now) &&
    (ends === null || Number.isNaN(ends) || ends >= now)
  );
};

export const loadActiveModuleAssignments = async (
  user: User | null
): Promise<AppModuleAssignment[]> => {
  if (!hasSupabaseEnv() || !user) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("module_assignments")
    .select(
      "module_code, starts_at, ends_at, modules(code, title, description, sort_order, is_active)"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("module_code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as Array<ModuleAssignmentRow & { starts_at?: string | null; ends_at?: string | null }>)
    .filter((row) => row.modules?.is_active && isActiveInWindow(row.starts_at, row.ends_at))
    .map((row) => ({
      code: row.module_code,
      title: row.modules?.title || row.module_code,
      description: row.modules?.description || "",
      sortOrder: row.modules?.sort_order ?? 100,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
};

export const loadCurrentUserProfile = async (
  user: User | null
): Promise<AppUserProfile | null> => {
  if (!hasSupabaseEnv() || !user) return null;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, company_name, role, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as {
    id: string;
    email: string;
    full_name: string | null;
    company_name: string | null;
    role: AppUserRole;
    organization_id: string | null;
  };

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    companyName: row.company_name,
    role: row.role,
    organizationId: row.organization_id,
  };
};

export const updateCurrentUserProfileDetails = async (
  user: User,
  details: {
    fullName: string;
    companyName: string;
  }
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { error } = await db
    .from("profiles")
    .update({
      full_name: details.fullName.trim(),
      company_name: details.companyName.trim(),
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }
};
