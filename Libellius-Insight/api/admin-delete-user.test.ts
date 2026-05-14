import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createClient } from "@supabase/supabase-js";
import handler from "./admin-delete-user";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

type MockReq = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type MockRes = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string | number>;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
  setHeader: (name: string, value: string | number) => void;
};

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";

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
    userId: TARGET_ID,
  },
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

const createClients = (options?: {
  isAdmin?: boolean;
  targetUser?: unknown;
  targetUserError?: unknown;
  deleteError?: unknown;
}) => {
  const authClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: ADMIN_ID } },
        error: null,
      }),
    },
  };
  const userScopedClient = {
    rpc: vi.fn().mockResolvedValue({
      data: options?.isAdmin ?? true,
      error: null,
    }),
  };
  const getUserById = vi.fn().mockResolvedValue({
    data: {
      user:
        options && "targetUser" in options
          ? options.targetUser
          : {
              id: TARGET_ID,
              email: "participant@example.com",
              user_metadata: { full_name: "Participant One" },
            },
    },
    error: options?.targetUserError || null,
  });
  const deleteUser = vi.fn().mockResolvedValue({
    error: options?.deleteError || null,
  });
  const queues: Record<string, any[]> = {
    admin_audit_log: [insertBuilder({ error: null })],
  };
  const adminClient = {
    auth: {
      admin: {
        getUserById,
        deleteUser,
      },
    },
    from: vi.fn((table: string) => {
      const nextBuilder = queues[table]?.shift();
      if (!nextBuilder) throw new Error(`Unexpected table access: ${table}`);
      return nextBuilder;
    }),
  };

  createClientMock
    .mockReturnValueOnce(authClient)
    .mockReturnValueOnce(userScopedClient)
    .mockReturnValueOnce(adminClient);
  return { authClient, userScopedClient, adminClient, getUserById, deleteUser };
};

describe("api/admin-delete-user handler", () => {
  it("returns 401 when authorization token is missing", async () => {
    const req = baseReq();
    req.headers = {};
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: "Pre odstránenie používateľa sa prihláste ako admin.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid target user", async () => {
    const req = baseReq();
    req.body = { userId: "bad" };
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Chýba platné ID používateľa.",
    });
  });

  it("returns 403 when authenticated user is not admin", async () => {
    const { deleteUser } = createClients({ isAdmin: false });
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: "Na odstránenie používateľa nemáte oprávnenie.",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("returns 400 when admin tries to delete own account", async () => {
    createClients();
    const req = baseReq();
    req.body = { userId: ADMIN_ID };
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Vlastné konto nie je možné odstrániť.",
    });
  });

  it("returns 404 when target auth user does not exist", async () => {
    const { deleteUser } = createClients({ targetUser: null });
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: "Používateľ nebol nájdený.",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("returns 200 and deletes the auth user without reading profiles", async () => {
    const { userScopedClient, adminClient, getUserById, deleteUser } = createClients();
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ userId: TARGET_ID });
    expect(userScopedClient.rpc).toHaveBeenCalledWith("is_global_admin");
    expect(getUserById).toHaveBeenCalledWith(TARGET_ID);
    expect(deleteUser).toHaveBeenCalledWith(TARGET_ID);
    expect(adminClient.from).toHaveBeenCalledWith("admin_audit_log");
    expect(adminClient.from).not.toHaveBeenCalledWith("profiles");
  });
});
