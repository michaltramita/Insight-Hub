import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import LZString from "lz-string";
import {
  decryptReportFromUrlPayload,
  encryptReportToUrlPayload,
  getPayloadPbkdf2Iterations,
  PBKDF2_ITERATIONS_LEGACY,
  PBKDF2_ITERATIONS_V4,
} from "./reportCrypto";

const PASSWORD = "VeryStrongPass123!";
const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const gzipCompress = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const compressedStream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressedBuffer = await new Response(compressedStream).arrayBuffer();
  return new Uint8Array(compressedBuffer);
};

const deriveLegacyKey = async (password: string, salt: Uint8Array) => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS_LEGACY,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
};

const encryptLegacyPayload = async (
  version: "v2" | "v3",
  report: unknown,
  password: string
) => {
  const json = JSON.stringify(report);
  const bytes =
    version === "v2"
      ? LZString.compressToUint8Array(json)
      : await gzipCompress(encoder.encode(json));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveLegacyKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return [
    version,
    toBase64Url(salt),
    toBase64Url(iv),
    toBase64Url(new Uint8Array(encrypted)),
  ].join(".");
};

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
  it("encrypts report to v4 payload format", async () => {
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
    expect(parts[0]).toBe("v4");
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
  it("decrypts valid v4 payload back to original object (happy path)", async () => {
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

  it("decrypts legacy v2 and v3 payload fixtures", async () => {
    const report = {
      mode: "ZAMESTNANECKA_SPOKOJNOST",
      reportMetadata: { date: "2026-04-03", scaleMax: 5 },
      satisfaction: { clientName: "Legacy Client" },
    };
    const v2Payload = await encryptLegacyPayload("v2", report, PASSWORD);
    const v3Payload = await encryptLegacyPayload("v3", report, PASSWORD);

    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(decryptReportFromUrlPayload(v2Payload, PASSWORD)).resolves.toEqual(report);
    await expect(decryptReportFromUrlPayload(v3Payload, PASSWORD)).resolves.toEqual(report);
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

  it("uses stronger v4 PBKDF2 settings than legacy payloads", async () => {
    expect(getPayloadPbkdf2Iterations("v2")).toBe(PBKDF2_ITERATIONS_LEGACY);
    expect(getPayloadPbkdf2Iterations("v3")).toBe(PBKDF2_ITERATIONS_LEGACY);
    expect(getPayloadPbkdf2Iterations("v4")).toBe(PBKDF2_ITERATIONS_V4);
    expect(PBKDF2_ITERATIONS_V4).toBeGreaterThan(PBKDF2_ITERATIONS_LEGACY);
  });

  it("takes measurably longer to decrypt v4 than legacy v2", async () => {
    const report = { mode: "360_FEEDBACK", tiny: true };
    const v2Payload = await encryptLegacyPayload("v2", report, PASSWORD);
    const v4Payload = await encryptReportToUrlPayload(report, PASSWORD);

    vi.spyOn(console, "log").mockImplementation(() => {});

    const legacyStart = performance.now();
    await decryptReportFromUrlPayload(v2Payload, PASSWORD);
    const legacyDuration = performance.now() - legacyStart;

    const v4Start = performance.now();
    await decryptReportFromUrlPayload(v4Payload, PASSWORD);
    const v4Duration = performance.now() - v4Start;

    expect(v4Duration).toBeGreaterThan(legacyDuration);
  });
});
