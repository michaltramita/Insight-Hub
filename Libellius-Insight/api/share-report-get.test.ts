import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { get } from "@vercel/blob";
import { consumeRateLimit, getClientIp } from "./rate-limit.js";
import handler from "./share-report-get";

vi.mock("@vercel/blob", () => ({
  get: vi.fn(),
}));

vi.mock("./rate-limit.js", () => ({
  consumeRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

type MockReq = {
  method?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
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
  method: "GET",
  query: { id: "AbcdEF12" },
  headers: {},
});

const getMock = get as unknown as Mock;
const consumeRateLimitMock = consumeRateLimit as unknown as Mock;
const getClientIpMock = getClientIp as unknown as Mock;
const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;

beforeEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  getMock.mockReset();
  consumeRateLimitMock.mockReset();
  getClientIpMock.mockReset();

  consumeRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  getClientIpMock.mockReturnValue("127.0.0.1");
});

afterEach(() => {
  if (originalBlobToken === undefined) {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  }
});

describe("api/share-report-get handler", () => {
  it("returns 200 + stable response contract on success", async () => {
    getMock.mockResolvedValueOnce({
      statusCode: 200,
      stream: new Blob([
        JSON.stringify({
          encryptedPayload: "  v2.aaa.bbb.ccc  ",
          publicMeta: {
            client: "  Acme  ",
            survey: "",
            issued: 0,
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2999-01-01T00:00:00.000Z",
        }),
      ]).stream(),
    });

    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      encryptedPayload: "v2.aaa.bbb.ccc",
      publicMeta: {
        client: "Acme",
        survey: undefined,
        issued: undefined,
      },
    });
    expect(Object.keys(res.body as Record<string, unknown>)).toEqual([
      "encryptedPayload",
      "publicMeta",
    ]);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(getMock).toHaveBeenCalledWith("shared-reports/AbcdEF12.json", {
      access: "private",
    });
  });

  it("returns 400 for invalid share id", async () => {
    const req = baseReq();
    req.query = { id: "bad id" };
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Neplatné ID zdieľania." });
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns 404 when blob is not found", async () => {
    getMock.mockResolvedValueOnce(null);
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Zdieľaný report nebol nájdený." });
  });

  it("returns 410 when share is expired", async () => {
    getMock.mockResolvedValueOnce({
      statusCode: 200,
      stream: new Blob([
        JSON.stringify({
          encryptedPayload: "v2.aaa.bbb.ccc",
          publicMeta: {},
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2000-01-01T00:00:00.000Z",
        }),
      ]).stream(),
    });
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(410);
    expect(res.body).toEqual({
      error: "Tento zdieľaný link expiroval. Vygenerujte prosím nový.",
    });
  });

  it("returns 422 when report payload is too large", async () => {
    const hugePayload = "x".repeat(350001);
    getMock.mockResolvedValueOnce({
      statusCode: 200,
      stream: new Blob([hugePayload]).stream(),
    });
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: "Zdieľaný report je príliš veľký." });
  });

  it("returns 422 when encrypted payload in stored report is invalid", async () => {
    getMock.mockResolvedValueOnce({
      statusCode: 200,
      stream: new Blob([
        JSON.stringify({
          encryptedPayload: "bad",
          publicMeta: {},
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2999-01-01T00:00:00.000Z",
        }),
      ]).stream(),
    });
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: "Zdieľaný report je poškodený." });
  });

  it("returns 429 and Retry-After header when rate limit is exceeded", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 9,
    });
    const req = baseReq();
    const res = createMockRes();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("9");
    expect(res.body).toEqual({
      error: "Príliš veľa požiadaviek. Skúste to znova o chvíľu.",
    });
    expect(getMock).not.toHaveBeenCalled();
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
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected runtime error", async () => {
    getMock.mockRejectedValueOnce(new Error("blob failure"));
    const req = baseReq();
    const res = createMockRes();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: "Link reportu sa nepodarilo načítať.",
    });
  });
});
