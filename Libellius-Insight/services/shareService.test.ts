import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSharedReport, resolveSharedReport } from "./shareService";

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  hasSupabaseEnv: () => true,
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: supabaseMocks.getSession,
    },
  }),
}));

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const asResponse = (value: MockResponse) => value as unknown as Response;

beforeEach(() => {
  supabaseMocks.getSession.mockReset();
  supabaseMocks.getSession.mockResolvedValue({
    data: {
      session: {
        access_token: "test-access-token",
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSharedReport", () => {
  it("returns parsed share id on success and calls correct endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      asResponse({
        ok: true,
        status: 200,
        json: async () => ({ shareId: "abc123XYZ_" }),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSharedReport("encrypted_payload", {
      client: "Acme",
      survey: "Q1",
      issued: "2026-04-03",
    });

    expect(result).toEqual({ shareId: "abc123XYZ_" });
    expect(fetchMock).toHaveBeenCalledWith("/api/share-report-create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-access-token",
      },
      body: JSON.stringify({
        encryptedPayload: "encrypted_payload",
        publicMeta: {
          client: "Acme",
          survey: "Q1",
          issued: "2026-04-03",
        },
      }),
    });
  });

  it("throws status-enriched error from error + details payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        asResponse({
          ok: false,
          status: 429,
          json: async () => ({
            error: "Príliš veľa požiadaviek.",
            details: "Skúste to neskôr.",
          }),
        })
      )
    );

    await expect(
      createSharedReport("payload", { client: "A" })
    ).rejects.toMatchObject({
      message: "Príliš veľa požiadaviek. Skúste to neskôr.",
      status: 429,
    });
  });

  it("uses fallback message when error response cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        asResponse({
          ok: false,
          status: 500,
          json: async () => {
            throw new Error("invalid json");
          },
        })
      )
    );

    await expect(
      createSharedReport("payload", {})
    ).rejects.toMatchObject({
      message: "Nepodarilo sa vytvoriť zdieľaný odkaz.",
      status: 500,
    });
  });

  it("fails when server success response does not contain valid shareId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        asResponse({
          ok: true,
          status: 200,
          json: async () => ({ shareId: 123 }),
        })
      )
    );

    await expect(createSharedReport("payload", {})).rejects.toThrow(
      "Server nevrátil platné ID zdieľania."
    );
  });

  it("requires an authenticated session before creating a share link", async () => {
    supabaseMocks.getSession.mockResolvedValueOnce({
      data: {
        session: null,
      },
    });

    await expect(createSharedReport("payload", {})).rejects.toThrow(
      "Pre vytvorenie zdieľaného odkazu sa prihláste."
    );
  });
});

describe("resolveSharedReport", () => {
  it("returns parsed payload on success and keeps response contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      asResponse({
        ok: true,
        status: 200,
        json: async () => ({
          encryptedPayload: "v2.xxx.yyy.zzz",
          publicMeta: {
            client: "Acme",
            survey: "Survey",
          },
        }),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveSharedReport("my share/id");

    expect(result).toEqual({
      encryptedPayload: "v2.xxx.yyy.zzz",
      publicMeta: {
        client: "Acme",
        survey: "Survey",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/share-report-get?id=my%20share%2Fid",
      {
        method: "GET",
        cache: "no-store",
      }
    );
  });

  it("propagates details-only message and status on failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        asResponse({
          ok: false,
          status: 404,
          json: async () => ({ details: "Report neexistuje." }),
        })
      )
    );

    await expect(resolveSharedReport("missing")).rejects.toMatchObject({
      message: "Report neexistuje.",
      status: 404,
    });
  });

  it("uses fallback message when failed response has no error/details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        asResponse({
          ok: false,
          status: 400,
          json: async () => ({ message: "ignored" }),
        })
      )
    );

    await expect(resolveSharedReport("invalid")).rejects.toMatchObject({
      message: "Link reportu sa nepodarilo načítať.",
      status: 400,
    });
  });

  it("fails when success response is missing encryptedPayload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        asResponse({
          ok: true,
          status: 200,
          json: async () => ({ publicMeta: { client: "X" } }),
        })
      )
    );

    await expect(resolveSharedReport("abc")).rejects.toThrow(
      "V zdieľanom reporte chýba šifrovaný payload."
    );
  });
});
