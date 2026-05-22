import { describe, expect, it } from "vitest";
import type { TypologyAdminResult, TypologyStyleCode } from "./typologyTest";
import { buildTypologyReportModel } from "./typologyReportModel";

type ScoreMap = Record<TypologyStyleCode, number>;

const makeResult = (scores: ScoreMap | null): TypologyAdminResult => ({
  sessionId: "session-1",
  userEmail: "tester@example.com",
  fullName: "Test User",
  companyName: "DemoLab",
  status: "completed",
  startedAt: "2026-05-10T08:00:00.000Z",
  completedAt: "2026-05-10T09:00:00.000Z",
  scores,
  dominantStyle: null,
  calculatedAt: "2026-05-10T09:00:00.000Z",
});

describe("buildTypologyReportModel", () => {
  it("returns null for missing scores", () => {
    expect(buildTypologyReportModel(makeResult(null))).toBeNull();
  });

  it.each([
    {
      dominantCode: "a" as const,
      scores: { a: 90, b: 60, c: 40, d: 20 },
    },
    {
      dominantCode: "b" as const,
      scores: { a: 20, b: 90, c: 60, d: 40 },
    },
    {
      dominantCode: "c" as const,
      scores: { a: 40, b: 20, c: 92, d: 60 },
    },
    {
      dominantCode: "d" as const,
      scores: { a: 30, b: 20, c: 50, d: 91 },
    },
  ])("builds stable view-model for dominant style $dominantCode", ({ dominantCode, scores }) => {
    const model = buildTypologyReportModel(makeResult(scores));

    expect(model).not.toBeNull();
    expect(model?.scores).toHaveLength(4);
    expect(model?.scores[0]?.code).toBe(dominantCode);
    expect(model?.primary.code).toBe(dominantCode);

    expect(model?.summary.length).toBeGreaterThan(0);
    expect(model?.drivers.length).toBeGreaterThan(0);
    expect(model?.blockers.length).toBeGreaterThan(0);
    expect(model?.communication.length).toBeGreaterThan(0);
    expect(model?.leadershipFocus.length).toBeGreaterThan(0);
    expect(model?.developmentActions.length).toBeGreaterThan(0);

    expect(model?.reflectionQuestions).toHaveLength(4);
    expect(model?.profileReadingNote.length).toBeGreaterThan(0);
  });
});
