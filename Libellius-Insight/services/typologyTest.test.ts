import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canParticipantViewTypologyResult,
  loadTypologyAdminResults,
  loadTypologyAdminResultsOverview,
  loadTypologyTest,
} from "./typologyTest";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({
    from: supabaseMocks.from,
  }),
}));

const createSelectBuilder = (
  result: unknown,
  selectLog: string[] = []
) => {
  const builder: any = {};
  builder.select = vi.fn((columns: string) => {
    selectLog.push(columns);
    return builder;
  });
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: unknown, reject: unknown) =>
    Promise.resolve(result).then(resolve as never, reject as never);
  return builder;
};

const user = {
  id: "user-1",
  email: "participant@example.com",
} as any;

const questionRows = [
  {
    id: "question-1-a",
    question_no: 1,
    option_key: "a",
    style_code: "a",
    statement: "A",
    sort_order: 1,
  },
  {
    id: "question-1-b",
    question_no: 1,
    option_key: "b",
    style_code: "b",
    statement: "B",
    sort_order: 2,
  },
  {
    id: "question-1-c",
    question_no: 1,
    option_key: "c",
    style_code: "c",
    statement: "C",
    sort_order: 3,
  },
  {
    id: "question-1-d",
    question_no: 1,
    option_key: "d",
    style_code: "d",
    statement: "D",
    sort_order: 4,
  },
];

beforeEach(() => {
  supabaseMocks.from.mockReset();
});

describe("canParticipantViewTypologyResult", () => {
  it("allows released completed results and blocks unreleased ones", () => {
    const now = new Date("2026-05-06T12:00:00.000Z");

    expect(
      canParticipantViewTypologyResult(
        {
          completedAt: "2026-05-05T12:00:00.000Z",
          participantResultsAvailableAt: "2026-05-06T11:59:00.000Z",
        },
        now
      )
    ).toBe(true);

    expect(
      canParticipantViewTypologyResult(
        {
          completedAt: "2026-05-05T12:00:00.000Z",
          participantResultsAvailableAt: "2026-05-06T12:01:00.000Z",
        },
        now
      )
    ).toBe(false);
  });
});

describe("loadTypologyTest", () => {
  it("falls back when the participant result release column is not migrated yet", async () => {
    const selectLog: string[] = [];

    supabaseMocks.from
      .mockReturnValueOnce(
        createSelectBuilder(
          {
            data: null,
            error: {
              code: "42703",
              message:
                'column typology_tests.participant_results_available_at does not exist',
            },
          },
          selectLog
        )
      )
      .mockReturnValueOnce(
        createSelectBuilder(
          {
            data: [
              {
                id: "test-1",
                title: "Test typológie pri vedení ľudí",
                description: "Legacy row",
              },
            ],
            error: null,
          },
          selectLog
        )
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: questionRows,
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: null,
          error: {
            code: "42P01",
            message: 'relation "public.company_project_participants" does not exist',
          },
        })
      );

    const result = await loadTypologyTest(user);

    expect(result).toMatchObject({
      id: "test-1",
      title: "Analýza osobnostnej typológie",
      participantResultsAvailableAt: null,
      resultAccessScope: "project",
      completedAt: null,
    });
    expect(result?.groups).toHaveLength(1);
    expect(selectLog).toEqual([
      "id, title, description, participant_results_available_at",
      "id, title, description",
    ]);
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(1, "typology_tests");
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(2, "typology_tests");
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(
      5,
      "company_project_participants"
    );
  });

  it("uses project release date for result visibility when user is assigned to a project", async () => {
    supabaseMocks.from
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [
            {
              id: "test-1",
              title: "Analýza osobnostnej typológie",
              description: "Aktívny test",
              participant_results_available_at: "2099-01-01T00:00:00.000Z",
            },
          ],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: questionRows,
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [
            {
              id: "session-1",
              status: "completed",
              completed_at: "2026-05-06T10:00:00.000Z",
              profiles: {
                email: "participant@example.com",
                full_name: "Participant User",
                company_name: "PREFA",
              },
            },
          ],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [
            {
              company_projects: {
                result_access_date: "2026-05-05T10:00:00.000Z",
              },
            },
          ],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: {
            session_id: "session-1",
            scores: { a: 60, b: 65, c: 55, d: 52 },
            dominant_style: "b",
            calculated_at: "2026-05-06T10:00:01.000Z",
          },
          error: null,
        })
      );

    const result = await loadTypologyTest(user);

    expect(result).toMatchObject({
      participantResultsAvailableAt: "2026-05-05T10:00:00.000Z",
      resultAccessScope: "project",
      participantResult: {
        sessionId: "session-1",
        dominantStyle: "b",
      },
    });
  });
});

describe("loadTypologyAdminResults", () => {
  it("adds project assignments to admin results", async () => {
    supabaseMocks.from
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [
            {
              id: "session-1",
              user_id: "user-1",
              status: "completed",
              started_at: "2026-05-06T09:00:00.000Z",
              completed_at: "2026-05-06T10:00:00.000Z",
              profiles: {
                email: "participant@example.com",
                full_name: "Participant User",
                company_name: "PREFA",
              },
              typology_results: [
                {
                  scores: { a: 60, b: 65, c: 55, d: 52 },
                  dominant_style: "b",
                  calculated_at: "2026-05-06T10:00:01.000Z",
                },
              ],
            },
          ],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [
            {
              user_id: "user-1",
              company_projects: {
                id: "project-1",
                name: "Leadership 2026",
                company_name: "PREFA",
                status: "active",
                result_access_date: "2026-05-20T10:00:00.000Z",
              },
            },
          ],
          error: null,
        })
      );

    const results = await loadTypologyAdminResults();

    expect(results).toMatchObject([
      {
        sessionId: "session-1",
        userId: "user-1",
        userEmail: "participant@example.com",
        dominantStyle: "b",
        projects: [
          {
            id: "project-1",
            name: "Leadership 2026",
            companyName: "PREFA",
            status: "active",
            resultAccessDate: "2026-05-20T10:00:00.000Z",
          },
        ],
      },
    ]);
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(1, "typology_sessions");
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(
      2,
      "company_project_participants"
    );
  });

  it("keeps admin results visible when project tables are not migrated yet", async () => {
    supabaseMocks.from
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [
            {
              id: "session-1",
              user_id: "user-1",
              status: "completed",
              started_at: "2026-05-06T09:00:00.000Z",
              completed_at: "2026-05-06T10:00:00.000Z",
              profiles: {
                email: "participant@example.com",
                full_name: "Participant User",
                company_name: "PREFA",
              },
              typology_results: null,
            },
          ],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: null,
          error: {
            code: "42P01",
            message: 'relation "public.company_project_participants" does not exist',
          },
        })
      );

    const results = await loadTypologyAdminResults();

    expect(results).toMatchObject([
      {
        sessionId: "session-1",
        userId: "user-1",
        projects: [],
      },
    ]);
  });
});

describe("loadTypologyAdminResultsOverview", () => {
  it("loads projects even when nobody has started a typology session", async () => {
    supabaseMocks.from
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [
            {
              id: "project-1",
              name: "Leadership 2026",
              company_name: "PREFA",
              status: "active",
              result_access_date: "2026-05-20T10:00:00.000Z",
            },
          ],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSelectBuilder({
          data: [
            { project_id: "project-1", user_id: "user-1" },
            { project_id: "project-1", user_id: "user-1" },
            { project_id: "project-1", user_id: "user-2" },
          ],
          error: null,
        })
      );

    const overview = await loadTypologyAdminResultsOverview();

    expect(overview.results).toEqual([]);
    expect(overview.projects).toMatchObject([
      {
        id: "project-1",
        name: "Leadership 2026",
        companyName: "PREFA",
        status: "active",
        resultAccessDate: "2026-05-20T10:00:00.000Z",
        participantIds: ["user-1", "user-2"],
      },
    ]);
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(1, "typology_sessions");
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(2, "company_projects");
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(
      3,
      "company_project_participants"
    );
  });
});
