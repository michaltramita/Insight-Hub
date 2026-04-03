import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  decryptReportFromUrlPayload,
  encryptReportToUrlPayload,
} from "./reportCrypto";

const PASSWORD = "VeryStrongPass123!";

beforeAll(() => {
  // Vitest/node fallback pre prostredia bez browser atob/btoa.
  if (typeof globalThis.btoa !== "function") {
    vi.stubGlobal("btoa", (value: string) =>
      Buffer.from(value, "binary").toString("base64")
    );
  }

  if (typeof globalThis.atob !== "function") {
    vi.stubGlobal("atob", (value: string) =>
      Buffer.from(value, "base64").toString("binary")
    );
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("encryptReportToUrlPayload", () => {
  it("encrypts report to v2 payload format", async () => {
    const payload = await encryptReportToUrlPayload(
      {
        mode: "ZAMESTNANECKA_SPOKOJNOST",
        reportMetadata: { date: "2026-04-03", scaleMax: 5 },
        satisfaction: { clientName: "Acme" },
      },
      PASSWORD
    );

    const parts = payload.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v2");
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
    expect(parts[3].length).toBeGreaterThan(0);
  });

  it("throws when password is shorter than 12 chars", async () => {
    await expect(
      encryptReportToUrlPayload({ ok: true }, "short-pass")
    ).rejects.toThrow("Heslo musí mať aspoň 12 znakov.");
  });
});

describe("decryptReportFromUrlPayload", () => {
  it("decrypts valid payload back to original object (happy path)", async () => {
    const report = {
      mode: "360_FEEDBACK",
      reportMetadata: { date: "2026-04-03", scaleMax: 5 },
      employees: [{ id: "1", name: "Alice" }],
    };
    const payload = await encryptReportToUrlPayload(report, PASSWORD);

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const decrypted = await decryptReportFromUrlPayload(payload, PASSWORD);

    expect(decrypted).toEqual(report);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("accepts payload wrapped in quotes and surrounding whitespace", async () => {
    const report = { mode: "360_FEEDBACK", reportMetadata: { date: "x", scaleMax: 5 } };
    const payload = await encryptReportToUrlPayload(report, PASSWORD);
    const wrappedPayload = `  "${payload}"  `;

    vi.spyOn(console, "log").mockImplementation(() => {});
    const decrypted = await decryptReportFromUrlPayload(wrappedPayload, PASSWORD);

    expect(decrypted).toEqual(report);
  });

  it("throws for missing payload, missing password and invalid format", async () => {
    await expect(decryptReportFromUrlPayload("", PASSWORD)).rejects.toThrow(
      "Chýba šifrovaný payload."
    );
    await expect(decryptReportFromUrlPayload("v2.a.b.c", "")).rejects.toThrow(
      "Chýba heslo."
    );
    await expect(decryptReportFromUrlPayload("bad-format", PASSWORD)).rejects.toThrow(
      "Neplatný formát odkazu."
    );
  });

  it("throws decode error message for malformed payload chunks", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      decryptReportFromUrlPayload("v2.%ZZZZ.###.!!!", PASSWORD)
    ).rejects.toThrow(
      "Poškodený alebo nekompletný odkaz. Vygenerujte prosím nový link reportu."
    );
  });

  it("throws generic decrypt error for wrong password", async () => {
    const payload = await encryptReportToUrlPayload({ foo: "bar" }, PASSWORD);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      decryptReportFromUrlPayload(payload, "WrongPassword123!")
    ).rejects.toThrow("Nesprávne heslo alebo poškodený (nekompletný) odkaz.");
  });
});
