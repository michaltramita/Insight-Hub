import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canParticipantViewTypologyResult,
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
      );

    const result = await loadTypologyTest(user);

    expect(result).toMatchObject({
      id: "test-1",
      title: "Analýza osobnostnej typológie",
      participantResultsAvailableAt: null,
      completedAt: null,
    });
    expect(result?.groups).toHaveLength(1);
    expect(selectLog).toEqual([
      "id, title, description, participant_results_available_at",
      "id, title, description",
    ]);
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(1, "typology_tests");
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(2, "typology_tests");
  });
});
