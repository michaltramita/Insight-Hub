import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { del, get } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { consumeRateLimit, getClientIp } from "../../api/_rate-limit.js";
import deleteHandler from "../../api/share-report";
import getHandler from "../../api/share-report";

const blobMocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock("@vercel/blob", () => ({
  get: vi.fn(async (pathname: string) => {
    const value = blobMocks.store.get(pathname);
    if (!value) return null;
    return {
      statusCode: 200,
      stream: new Blob([value]).stream(),
    };
  }),
  del: vi.fn(async (pathname: string) => {
    blobMocks.store.delete(pathname);
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("../../api/_rate-limit.js", () => ({
  consumeRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

type MockReq = {
  method?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type MockRes = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
  setHeader: (name: string, value: string) => void;
};

const SHARE_ID = "AbcdEF12";
const SHARE_PATH = `shared-reports/${SHARE_ID}.json`;

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
    authorization: "Bearer test-access-token",
  },
  body: { shareId: SHARE_ID },
});

const storedReport = (ownerUserId: string) =>
  JSON.stringify({
    encryptedPayload: "v4.aaa.bbb.ccc",
    ownerUserId,
    publicMeta: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2999-01-01T00:00:00.000Z",
  });

const getMock = get as unknown as Mock;
const delMock = del as unknown as Mock;
const createClientMock = createClient as unknown as Mock;
const consumeRateLimitMock = consumeRateLimit as unknown as Mock;
const getClientIpMock = getClientIp as unknown as Mock;
const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;

beforeEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  blobMocks.store.clear();
  getMock.mockClear();
  delMock.mockClear();
  createClientMock.mockReset();
  consumeRateLimitMock.mockReset();
  getClientIpMock.mockReset();

  consumeRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  getClientIpMock.mockReturnValue("127.0.0.1");
  createClientMock.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
  });
});

afterEach(() => {
  if (originalBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;

  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;

  if (originalSupabaseAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
});

describe("api/share-report-delete handler", () => {
  it("lets the owner delete a share and get returns 404 afterwards", async () => {
    blobMocks.store.set(SHARE_PATH, storedReport("user-1"));
    const req = baseReq();
    const res = createMockRes();

    await deleteHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ shareId: SHARE_ID });
    expect(delMock).toHaveBeenCalledWith(SHARE_PATH);

    const getReq: MockReq = {
      method: "GET",
      query: { id: SHARE_ID },
      headers: {},
    };
    const getRes = createMockRes();
    await getHandler(getReq as any, getRes as any);

    expect(getRes.statusCode).toBe(404);
    expect(getRes.body).toEqual({ error: "Zdieľaný report nebol nájdený." });
  });

  it("lets a global admin delete a share owned by someone else", async () => {
    blobMocks.store.set(SHARE_PATH, storedReport("other-user"));
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    });
    const req = baseReq();
    const res = createMockRes();

    await deleteHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(delMock).toHaveBeenCalledWith(SHARE_PATH);
  });

  it("returns 403 for a different non-admin user", async () => {
    blobMocks.store.set(SHARE_PATH, storedReport("other-user"));
    const req = baseReq();
    const res = createMockRes();

    await deleteHandler(req as any, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: "Na zrušenie tohto zdieľaného odkazu nemáte oprávnenie.",
    });
    expect(delMock).not.toHaveBeenCalled();
  });

  it("returns 401 for anonymous requests", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: vi.fn(),
    });
    const req = baseReq();
    const res = createMockRes();

    await deleteHandler(req as any, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: "Pre zrušenie zdieľaného odkazu sa prihláste.",
    });
  });

  it("returns 404 for a missing share id", async () => {
    const req = baseReq();
    const res = createMockRes();

    await deleteHandler(req as any, res as any);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Zdieľaný report nebol nájdený." });
  });

  it("returns 429 and Retry-After header when rate limit is exceeded", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 7,
    });
    const req = baseReq();
    const res = createMockRes();

    await deleteHandler(req as any, res as any);

    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("7");
    expect(res.body).toEqual({
      error: "Príliš veľa požiadaviek. Skúste to znova o chvíľu.",
    });
    expect(delMock).not.toHaveBeenCalled();
  });
});
