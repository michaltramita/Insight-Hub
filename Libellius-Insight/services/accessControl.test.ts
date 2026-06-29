import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCurrentUserProfile, normalizeAppUserRole } from "./accessControl";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  hasSupabaseEnv: () => true,
  getSupabaseBrowserClient: () => ({
    from: supabaseMocks.from,
  }),
}));

const createProfileBuilder = (result: unknown) => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
};

beforeEach(() => {
  supabaseMocks.from.mockReset();
});

describe("normalizeAppUserRole", () => {
  it("preserves admin and maps legacy roles to participant", () => {
    expect(normalizeAppUserRole("admin")).toBe("admin");
    expect(normalizeAppUserRole("participant")).toBe("participant");
    expect(normalizeAppUserRole("manager")).toBe("participant");
    expect(normalizeAppUserRole("consultant")).toBe("participant");
    expect(normalizeAppUserRole("unexpected")).toBe("participant");
    expect(normalizeAppUserRole(null)).toBe("participant");
  });
});

describe("loadCurrentUserProfile", () => {
  it("normalizes a legacy consultant profile to participant", async () => {
    supabaseMocks.from.mockReturnValueOnce(
      createProfileBuilder({
        data: {
          id: "user-1",
          email: "legacy@example.com",
          full_name: "Legacy Consultant",
          company_name: "Libellius",
          role: "consultant",
          organization_id: "org-1",
        },
        error: null,
      })
    );

    const result = await loadCurrentUserProfile({ id: "user-1" } as any);

    expect(result).toMatchObject({
      id: "user-1",
      email: "legacy@example.com",
      role: "participant",
      organizationId: "org-1",
    });
    expect(supabaseMocks.from).toHaveBeenCalledWith("profiles");
  });
});
