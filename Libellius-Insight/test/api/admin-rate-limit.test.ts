import { describe, expect, it } from "vitest";
import createUserHandler from "../../api/admin-create-user";
import deleteUserHandler from "../../api/admin-delete-user";
import resetUserPasswordHandler from "../../api/admin-reset-user-password";
import createOrganizationHandler from "../../api/admin-create-organization";
import deleteOrganizationHandler from "../../api/admin-delete-organization";
import deleteProjectHandler from "../../api/admin-delete-project";

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

const baseReq = (body: Record<string, unknown>): MockReq => ({
  method: "POST",
  headers: {
    "x-forwarded-for": "203.0.113.10",
  },
  body,
});

const cases = [
  {
    name: "admin-create-user",
    limit: 10,
    handler: createUserHandler,
    body: {
      email: "participant@example.com",
      password: "newsecure123",
      fullName: "Participant One",
      companyName: "",
      organizationId: TARGET_ID,
      projectId: null,
      moduleCodes: [],
    },
  },
  {
    name: "admin-delete-user",
    limit: 10,
    handler: deleteUserHandler,
    body: { userId: TARGET_ID },
  },
  {
    name: "admin-reset-user-password",
    limit: 5,
    handler: resetUserPasswordHandler,
    body: { userId: TARGET_ID, password: "newsecure123" },
  },
  {
    name: "admin-create-organization",
    limit: 10,
    handler: createOrganizationHandler,
    body: { name: "Rate Limited Organization" },
  },
  {
    name: "admin-delete-organization",
    limit: 10,
    handler: deleteOrganizationHandler,
    body: { organizationId: TARGET_ID },
  },
  {
    name: "admin-delete-project",
    limit: 20,
    handler: deleteProjectHandler,
    body: { projectId: TARGET_ID },
  },
];

describe("admin endpoint IP rate limits", () => {
  for (const item of cases) {
    it(`returns 429 and Retry-After after repeated ${item.name} requests from one IP`, async () => {
      let lastRes = createMockRes();

      for (let attempt = 0; attempt <= item.limit; attempt += 1) {
        const res = createMockRes();
        await item.handler(baseReq(item.body) as any, res as any);
        lastRes = res;
      }

      expect(lastRes.statusCode).toBe(429);
      expect(lastRes.headers["Retry-After"]).toBeDefined();
      expect(lastRes.body).toEqual({
        error:
          "Príliš veľa administrátorských požiadaviek. Skúste to znova o chvíľu.",
      });
    });
  }
});
