import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createClient } from "@supabase/supabase-js";
import handler from "./admin-create-user";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

type MockReq = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

type MockRes = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string | number>;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
  setHeader: (name: string, value: string | number) => void;
};

const createMockRes = (): MockRes => {
  const res: MockRes = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
  return res;
};

const baseReq = (): MockReq => ({
  method: "POST",
  headers: {
    authorization: "Bearer admin-token",
  },
  body: {
    email: "participant@example.com",
    password: "temporary123",
    fullName: "Participant User",
    companyName: "Libellius",
    organizationId: "org-1",
    moduleCodes: ["TYPOLOGY_LEADERSHIP"],
  },
});

const singleBuilder = (result: unknown) => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn().mockResolvedValue(result);
  return builder;
};

const modulesBuilder = (result: unknown) => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.eq = vi.fn().mockResolvedValue(result);
  return builder;
};

const upsertBuilder = (result: unknown) => ({
  upsert: vi.fn().mockResolvedValue(result),
});

const insertBuilder = (result: unknown) => ({
  insert: vi.fn().mockResolvedValue(result),
});

const createClientMock = createClient as unknown as Mock;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  createClientMock.mockReset();
});

afterEach(() => {
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;

  if (originalSupabaseAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;

  if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
});

const createClients = (options?: { actorRole?: string }) => {
  const authClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-1" } },
        error: null,
      }),
    },
  };
  const createUser = vi.fn().mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  const queues: Record<string, any[]> = {
    profiles: [
      singleBuilder({
        data: { id: "admin-1", role: options?.actorRole || "admin" },
        error: null,
      }),
      upsertBuilder({ error: null }),
    ],
    organizations: [singleBuilder({ data: { id: "org-1" }, error: null })],
    modules: [
      modulesBuilder({
        data: [{ code: "TYPOLOGY_LEADERSHIP" }],
        error: null,
      }),
    ],
    module_assignments: [upsertBuilder({ error: null })],
    admin_audit_log: [insertBuilder({ error: null })],
  };
  const adminClient = {
    auth: {
      admin: {
        createUser,
      },
    },
    from: vi.fn((table: string) => {
      const nextBuilder = queues[table]?.shift();
      if (!nextBuilder) throw new Error(`Unexpected table access: ${table}`);
      return nextBuilder;
    }),
  };

  createClientMock.mockReturnValueOnce(authClient).mockReturnValueOnce(adminClient);
  return { authClient, adminClient, createUser };
};

describe("api/admin-create-user handler", () => {
  it("returns 401 when authorization token is missing", async () => {
    const req = baseReq();
    req.headers = {};
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: "Pre vytvorenie používateľa sa prihláste ako admin.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated user is not admin", async () => {
    createClients({ actorRole: "participant" });
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: "Na vytvorenie používateľa nemáte oprávnenie.",
    });
  });

  it("returns 400 for invalid email, password and module input", async () => {
    const invalidEmailReq = baseReq();
    invalidEmailReq.body = { ...(invalidEmailReq.body as object), email: "bad" };
    const invalidEmailRes = createMockRes();

    await handler(invalidEmailReq as any, invalidEmailRes as any);

    expect(invalidEmailRes.statusCode).toBe(400);
    expect(invalidEmailRes.body).toEqual({
      error: "Zadajte platný email používateľa.",
    });

    const invalidPasswordReq = baseReq();
    invalidPasswordReq.body = {
      ...(invalidPasswordReq.body as object),
      password: "short",
    };
    const invalidPasswordRes = createMockRes();

    await handler(invalidPasswordReq as any, invalidPasswordRes as any);

    expect(invalidPasswordRes.statusCode).toBe(400);
    expect(invalidPasswordRes.body).toEqual({
      error: "Dočasné heslo musí mať aspoň 8 znakov.",
    });

    const invalidModuleReq = baseReq();
    invalidModuleReq.body = {
      ...(invalidModuleReq.body as object),
      moduleCodes: ["BAD_MODULE"],
    };
    const invalidModuleRes = createMockRes();

    await handler(invalidModuleReq as any, invalidModuleRes as any);

    expect(invalidModuleRes.statusCode).toBe(400);
    expect(invalidModuleRes.body).toEqual({
      error: "Požiadavka obsahuje neplatný modul.",
    });
  });

  it("returns 201 and creates auth user, profile and assignments", async () => {
    const { adminClient, createUser } = createClients();
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ userId: "user-1" });
    expect(createUser).toHaveBeenCalledWith({
      email: "participant@example.com",
      password: "temporary123",
      email_confirm: true,
      user_metadata: { full_name: "Participant User" },
    });
    expect(adminClient.from).toHaveBeenCalledWith("profiles");
    expect(adminClient.from).toHaveBeenCalledWith("module_assignments");
    expect(adminClient.from).toHaveBeenCalledWith("admin_audit_log");
  });
});
