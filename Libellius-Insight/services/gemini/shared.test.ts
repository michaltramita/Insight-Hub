import { describe, expect, it } from "vitest";
import {
  ensureSpreadsheetLimits,
  inferMetaFromFileName,
  isExcludedTheme,
  normalizeHeaderName,
  toSafeIdToken,
} from "./shared";

describe("ensureSpreadsheetLimits", () => {
  it("allows values within limits, including boundaries", () => {
    expect(() => ensureSpreadsheetLimits(15000, 40)).not.toThrow();
    expect(() => ensureSpreadsheetLimits(0, 0)).not.toThrow();
  });

  it("treats negative inputs as zero", () => {
    expect(() => ensureSpreadsheetLimits(-1, -5)).not.toThrow();
  });

  it("throws for too many rows", () => {
    expect(() => ensureSpreadsheetLimits(15001, 1)).toThrow(
      "Excel/CSV obsahuje príliš veľa riadkov (15001). Maximum je 15000."
    );
  });

  it("throws for too many columns", () => {
    expect(() => ensureSpreadsheetLimits(1, 121)).toThrow(
      "Excel/CSV obsahuje príliš veľa stĺpcov (121). Maximum je 120."
    );
  });

  it("throws for too many cells", () => {
    expect(() => ensureSpreadsheetLimits(15000, 41)).toThrow(
      "Excel/CSV obsahuje príliš veľa buniek (615000). Maximum je 600000."
    );
  });
});

describe("normalizeHeaderName", () => {
  it("uses trimmed value when available", () => {
    const used = new Set<string>();
    const header = normalizeHeaderName("  Oddelenie  ", "Column", used);

    expect(header).toBe("Oddelenie");
    expect(used.has("oddelenie")).toBe(true);
  });

  it("falls back to provided fallback when value is empty", () => {
    const used = new Set<string>();
    const header = normalizeHeaderName("   ", "Column", used);

    expect(header).toBe("Column");
    expect(used.has("column")).toBe(true);
  });

  it("adds numeric suffix when case-insensitive duplicate exists", () => {
    const used = new Set<string>(["column", "column_2"]);
    const header = normalizeHeaderName("Column", "Fallback", used);

    expect(header).toBe("Column_3");
    expect(used.has("column_3")).toBe(true);
  });
});

describe("isExcludedTheme", () => {
  it("returns true for excluded 'bez odpovede' variants", () => {
    expect(isExcludedTheme("Bez odpovede")).toBe(true);
    expect(isExcludedTheme("bez-odpovedi")).toBe(true);
    expect(isExcludedTheme("BeZ   Odpovede")).toBe(true);
  });

  it("returns false for non-excluded values", () => {
    expect(isExcludedTheme("Komunikácia")).toBe(false);
    expect(isExcludedTheme("Bez odpovede tímu")).toBe(false);
  });
});

describe("inferMetaFromFileName", () => {
  it("returns empty metadata for empty filename", () => {
    expect(inferMetaFromFileName("")).toEqual({
      clientName: "",
      surveyName: "",
    });
  });

  it("extracts client name and survey from common InsightHub filename", () => {
    expect(inferMetaFromFileName("Acme_InsightHub_v2.xlsx")).toEqual({
      clientName: "Acme",
      surveyName: "Prieskum spokojnosti zamestnancov spoločnosti Acme",
    });
  });

  it("strips survey group suffix", () => {
    expect(inferMetaFromFileName("Contoso Survey Group 2025.csv")).toEqual({
      clientName: "Contoso",
      surveyName: "Prieskum spokojnosti zamestnancov spoločnosti Contoso",
    });
  });

  it("returns empty client when parsed name is shorter than 3 chars", () => {
    expect(inferMetaFromFileName("AB.xlsx")).toEqual({
      clientName: "",
      surveyName: "",
    });
  });
});

describe("toSafeIdToken", () => {
  it("normalizes accents, spaces and punctuation", () => {
    expect(toSafeIdToken("  Tím Žilina / QA  ")).toBe("tim_zilina_qa");
  });

  it("falls back to default token for empty/invalid input", () => {
    expect(toSafeIdToken("   ")).toBe("group");
    expect(toSafeIdToken("!!!")).toBe("group");
  });
});
