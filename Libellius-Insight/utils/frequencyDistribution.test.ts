import { describe, expect, it } from "vitest";
import {
  buildQuestionDistributionKey,
  buildQuestionTeamDistributionKey,
  normalizeScaleDistributionKey,
} from "./frequencyDistribution";

describe("normalizeScaleDistributionKey", () => {
  it("maps numeric scale values 1 to 5", () => {
    expect(normalizeScaleDistributionKey(1)).toBe("one");
    expect(normalizeScaleDistributionKey(2)).toBe("two");
    expect(normalizeScaleDistributionKey(3)).toBe("three");
    expect(normalizeScaleDistributionKey(4)).toBe("four");
    expect(normalizeScaleDistributionKey(5)).toBe("five");
  });

  it("maps N/A aliases to na", () => {
    expect(normalizeScaleDistributionKey("N/A")).toBe("na");
    expect(normalizeScaleDistributionKey(" n a ")).toBe("na");
    expect(normalizeScaleDistributionKey("N-A")).toBe("na");
  });

  it("parses numeric strings, including comma decimal separators", () => {
    expect(normalizeScaleDistributionKey(" 4 ")).toBe("four");
    expect(normalizeScaleDistributionKey("4,0")).toBe("four");
  });

  it("returns null for unsupported values", () => {
    expect(normalizeScaleDistributionKey(undefined)).toBeNull();
    expect(normalizeScaleDistributionKey(null)).toBeNull();
    expect(normalizeScaleDistributionKey("")).toBeNull();
    expect(normalizeScaleDistributionKey(0)).toBeNull();
    expect(normalizeScaleDistributionKey("5.5")).toBeNull();
    expect(normalizeScaleDistributionKey("text")).toBeNull();
  });
});

describe("buildQuestionDistributionKey", () => {
  it("prefers question id when present", () => {
    expect(buildQuestionDistributionKey("  Q-42  ", "ignored")).toBe("id:Q-42");
  });

  it("falls back to normalized question text when id is missing", () => {
    expect(buildQuestionDistributionKey("", "  Spokojnosť   tímu Žilina  ")).toBe(
      "text:spokojnost timu zilina"
    );
  });
});

describe("buildQuestionTeamDistributionKey", () => {
  it("builds stable key with normalized team name", () => {
    expect(buildQuestionTeamDistributionKey("id:Q-42", "  Tím   Žilina ")).toBe(
      "id:Q-42::tim zilina"
    );
  });
});
