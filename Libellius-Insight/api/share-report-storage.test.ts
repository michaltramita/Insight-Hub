import { afterEach, describe, expect, it } from "vitest";
import {
  createShareTimestamps,
  isShareExpired,
  isValidShareId,
  sanitizePublicMeta,
} from "./share-report-storage";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIXED_NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const ORIGINAL_TTL_ENV = process.env.SHARE_LINK_TTL_DAYS;

const setTtlEnv = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.SHARE_LINK_TTL_DAYS;
    return;
  }
  process.env.SHARE_LINK_TTL_DAYS = value;
};

afterEach(() => {
  setTtlEnv(ORIGINAL_TTL_ENV);
});

describe("createShareTimestamps", () => {
  it("uses default TTL (30 days) when env value is missing", () => {
    setTtlEnv(undefined);

    const result = createShareTimestamps(FIXED_NOW);

    expect(result).toEqual({
      createdAt: new Date(FIXED_NOW).toISOString(),
      expiresAt: new Date(FIXED_NOW + 30 * DAY_MS).toISOString(),
    });
  });

  it("clamps TTL to minimum 1 day", () => {
    setTtlEnv("0");

    const result = createShareTimestamps(FIXED_NOW);

    expect(result.expiresAt).toBe(new Date(FIXED_NOW + DAY_MS).toISOString());
  });

  it("clamps TTL to maximum 365 days", () => {
    setTtlEnv("999");

    const result = createShareTimestamps(FIXED_NOW);

    expect(result.expiresAt).toBe(new Date(FIXED_NOW + 365 * DAY_MS).toISOString());
  });
});

describe("isShareExpired", () => {
  it("prefers explicit expiresAt field", () => {
    setTtlEnv("1");
    const expiresAt = new Date(FIXED_NOW + 2 * DAY_MS).toISOString();

    expect(
      isShareExpired(
        { createdAt: "invalid-date", expiresAt },
        FIXED_NOW + DAY_MS
      )
    ).toBe(false);
    expect(
      isShareExpired(
        { createdAt: "invalid-date", expiresAt },
        FIXED_NOW + 2 * DAY_MS
      )
    ).toBe(true);
  });

  it("falls back to createdAt + TTL when expiresAt is missing", () => {
    setTtlEnv("2");
    const createdAt = new Date(FIXED_NOW).toISOString();

    expect(
      isShareExpired({ createdAt }, FIXED_NOW + 2 * DAY_MS - 1)
    ).toBe(false);
    expect(
      isShareExpired({ createdAt }, FIXED_NOW + 2 * DAY_MS)
    ).toBe(true);
  });

  it("returns true when createdAt is invalid and expiresAt is missing", () => {
    setTtlEnv("30");

    expect(isShareExpired({ createdAt: "not-a-date" }, FIXED_NOW)).toBe(true);
  });
});

describe("sanitizePublicMeta", () => {
  it("returns undefined fields for non-object meta", () => {
    expect(sanitizePublicMeta(null)).toEqual({
      client: undefined,
      survey: undefined,
      issued: undefined,
    });
  });

  it("trims values and limits length to 200 chars", () => {
    const long = `  ${"x".repeat(250)}  `;

    const result = sanitizePublicMeta({
      client: "  Acme  ",
      survey: long,
      issued: "  2026-04-03  ",
    });

    expect(result.client).toBe("Acme");
    expect(result.survey).toBe("x".repeat(200));
    expect(result.issued).toBe("2026-04-03");
  });

  it("keeps current behavior for falsy and non-string values", () => {
    const result = sanitizePublicMeta({
      client: 0,
      survey: false,
      issued: { date: "2026-01-01" },
    });

    expect(result).toEqual({
      client: undefined,
      survey: undefined,
      issued: "[object Object]",
    });
  });
});

describe("isValidShareId", () => {
  it("accepts valid IDs with allowed characters", () => {
    expect(isValidShareId("Abcdef12")).toBe(true);
    expect(isValidShareId("aBcd_12-XYZ")).toBe(true);
  });

  it("applies trim before validation", () => {
    expect(isValidShareId("  Abcdef12  ")).toBe(true);
  });

  it("rejects invalid IDs", () => {
    expect(isValidShareId("short7")).toBe(false);
    expect(isValidShareId("x".repeat(65))).toBe(false);
    expect(isValidShareId("invalid id")).toBe(false);
    expect(isValidShareId("invalid!id")).toBe(false);
  });
});
