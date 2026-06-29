import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "./_vercel-types.js";
import {
  enforceAdminIpRateLimit,
  enforceAdminUserRateLimit,
} from "./_admin-rate-limit.js";

const ADMIN_RATE_LIMIT = {
  endpoint: "create-organization",
  limit: 10,
  windowMs: 60_000,
};

const readSupabaseApiConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const readBearerToken = (req: VercelRequest) => {
  const rawHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const match = String(rawHeader || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const sendError = (res: VercelResponse, status: number, error: string) =>
  res.status(status).json({ error });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed");
  }
  if (!(await enforceAdminIpRateLimit(req, res, ADMIN_RATE_LIMIT))) return;

  const token = readBearerToken(req);
  if (!token) {
    return sendError(
      res,
      401,
      "Pre vytvorenie organizácie sa prihláste ako admin."
    );
  }

  const { url, anonKey, serviceRoleKey } = readSupabaseApiConfig();
  if (!url || !anonKey) {
    return sendError(
      res,
      500,
      "Supabase Auth nie je nakonfigurovaný pre API endpoint."
    );
  }
  if (!serviceRoleKey) {
    return sendError(res, 500, "Chýba konfigurácia administrátorského API.");
  }

  if (!isPlainObject(req.body)) {
    return sendError(res, 400, "Neplatné telo požiadavky.");
  }

  const name = normalizeText(req.body.name);
  if (!name) {
    return sendError(res, 400, "Zadajte názov organizácie.");
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
      return sendError(
        res,
        401,
        "Pre vytvorenie organizácie sa prihláste ako admin."
      );
    }

    const { data: isAdmin, error: adminCheckError } =
      await userScopedClient.rpc("is_global_admin");

    if (adminCheckError || isAdmin !== true) {
      return sendError(res, 403, "Na vytvorenie organizácie nemáte oprávnenie.");
    }
    if (
      !(await enforceAdminUserRateLimit(res, {
        ...ADMIN_RATE_LIMIT,
        userId: authData.user.id,
      }))
    ) {
      return;
    }

    const baseSlug = toSlug(name) || "org";
    let finalSlug = baseSlug;
    let suffix = 1;

    while (true) {
      const { data: existing, error: existingError } = await adminClient
        .from("organizations")
        .select("id")
        .eq("slug", finalSlug)
        .maybeSingle();

      if (existingError) {
        return sendError(
          res,
          500,
          "Existujúce organizácie sa nepodarilo overiť."
        );
      }

      if (!existing) break;
      suffix += 1;
      finalSlug = `${baseSlug}-${suffix}`;
    }

    const { data: inserted, error: insertError } = await adminClient
      .from("organizations")
      .insert({
        name,
        slug: finalSlug,
      })
      .select("id, name, slug")
      .single();

    if (insertError) {
      return sendError(
        res,
        500,
        "Organizáciu sa nepodarilo vytvoriť. Skontrolujte unikátnosť názvu."
      );
    }

    return res.status(201).json({
      organization: {
        id: inserted.id,
        name: inserted.name,
        slug: inserted.slug,
      },
    });
  } catch (error) {
    console.error("admin-create-organization error:", error);
    return sendError(res, 500, "Organizáciu sa nepodarilo vytvoriť.");
  }
}
