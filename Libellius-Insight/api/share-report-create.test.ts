import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { put } from "@vercel/blob";
import { consumeRateLimit, getClientIp } from "./rate-limit.js";
import handler from "./share-report-create";

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: supabaseMocks.createClient,
}));

vi.mock("./rate-limit.js", () => ({
  consumeRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

type MockReq = {
  method?: string;
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
    "content-type": "application/json",
    authorization: "Bearer test-access-token",
  },
  body: {
    encryptedPayload: "v2.aaa.bbb.ccc",
    publicMeta: {
      client: "  Acme  ",
      survey: "  Q1  ",
      issued: "  2026-04-03  ",
    },
  },
});

const putMock = put as unknown as Mock;
const consumeRateLimitMock = consumeRateLimit as unknown as Mock;
const getClientIpMock = getClientIp as unknown as Mock;
const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;

beforeEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  putMock.mockReset();
  consumeRateLimitMock.mockReset();
  getClientIpMock.mockReset();
  supabaseMocks.createClient.mockReset();
  supabaseMocks.getUser.mockReset();

  putMock.mockResolvedValue({});
  consumeRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  getClientIpMock.mockReturnValue("127.0.0.1");
  supabaseMocks.createClient.mockReturnValue({
    auth: {
      getUser: supabaseMocks.getUser,
    },
  });
  supabaseMocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: "user-1",
      },
    },
    error: null,
  });
});

afterEach(() => {
  if (originalBlobToken === undefined) {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  }
});

describe("api/share-report-create handler", () => {
  it("returns 401 when authorization token is missing", async () => {
    const req = baseReq();
    delete req.headers?.authorization;
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: "Pre vytvorenie zdieľaného odkazu sa prihláste.",
    });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 201 + stable response contract on success", async () => {
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ shareId: expect.any(String) });
    expect(Object.keys(res.body as Record<string, unknown>)).toEqual(["shareId"]);
    expect(res.headers["Cache-Control"]).toBe("no-store");

    expect(putMock).toHaveBeenCalledTimes(1);
    const [pathname, rawBody, options] = putMock.mock.calls[0];
    expect(pathname).toMatch(/^shared-reports\/[A-Za-z0-9_-]+\.json$/);
    expect(options).toMatchObject({
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });

    const parsedBody = JSON.parse(String(rawBody));
    expect(parsedBody).toMatchObject({
      encryptedPayload: "v2.aaa.bbb.ccc",
      publicMeta: {
        client: "Acme",
        survey: "Q1",
        issued: "2026-04-03",
      },
      createdAt: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  it("returns 400 for invalid encrypted payload", async () => {
    const req = baseReq();
    req.body = { encryptedPayload: "bad-payload-format" };
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Neplatný šifrovaný payload reportu." });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid publicMeta shape", async () => {
    const req = baseReq();
    req.body = { encryptedPayload: "v2.a.b.c", publicMeta: "invalid" };
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Neplatné verejné metadáta." });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 413 when request body is oversized", async () => {
    const req = baseReq();
    req.headers = {
      "content-type": "application/json",
      "content-length": "350001",
    };
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(413);
    expect(res.body).toEqual({ error: "Požiadavka je príliš veľká." });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 429 and Retry-After header when rate limit is exceeded", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 12,
    });
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("12");
    expect(res.body).toEqual({
      error: "Príliš veľa požiadaviek. Skúste to znova o chvíľu.",
    });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 500 when blob configuration is missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: "Chýba konfigurácia pre Vercel Blob.",
    });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected storage error", async () => {
    putMock.mockRejectedValueOnce(new Error("blob failed"));
    const req = baseReq();
    const res = createMockRes();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: "Nepodarilo sa vytvoriť zdieľaný odkaz.",
    });
  });
});
