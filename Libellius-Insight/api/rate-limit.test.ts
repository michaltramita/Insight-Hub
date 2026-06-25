import { describe, expect, it } from "vitest";
import { getClientIp } from "./rate-limit";

type MockReq = {
  headers: Record<string, string | string[] | undefined>;
};

describe("getClientIp", () => {
  it("prefers x-real-ip over client-controlled forwarded values", () => {
    const req: MockReq = {
      headers: {
        "x-real-ip": "198.51.100.24",
        "x-forwarded-for": "203.0.113.10, 198.51.100.24",
      },
    };

    expect(getClientIp(req as never)).toBe("198.51.100.24");
  });

  it("falls back to the last forwarded hop when x-real-ip is missing", () => {
    const req: MockReq = {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.24",
      },
    };

    expect(getClientIp(req as never)).toBe("198.51.100.24");
  });

  it("returns unknown when no trusted proxy headers are present", () => {
    expect(
      getClientIp({
        headers: {},
      } as never)
    ).toBe("unknown");
  });
});
