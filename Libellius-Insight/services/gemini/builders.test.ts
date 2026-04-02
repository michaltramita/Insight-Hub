import { describe, expect, it } from "vitest";
import {
  buildAreasFromQuantitative,
  buildEngagementFromMap,
  buildOpenQuestionsFromMap,
} from "./builders";
import { buildQuestionTeamDistributionKey } from "../../utils/frequencyDistribution";
import { FrequencyDistribution } from "../../types";

describe("buildOpenQuestionsFromMap", () => {
  it("builds trimmed responses and aggregates non-excluded themes", () => {
    const result = buildOpenQuestionsFromMap({
      "Team A": {
        "  Ako hodnotíte komunikáciu?  ": [
          { text: "  Veľmi dobrá ", tema: "Komunikácia" },
          { text: "", tema: "Ignorovať" },
          { text: "Mohlo by byť lepšie", tema: "Bez odpovede" },
          { text: "Rýchla spätná väzba", tema: "Komunikácia" },
          { text: "Chýbajú podklady", tema: "Procesy" },
          { text: "   ", tema: "Procesy" },
        ],
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].teamName).toBe("Team A");
    expect(result[0].questions).toHaveLength(1);

    const question = result[0].questions[0];
    expect(question.questionText).toBe("Ako hodnotíte komunikáciu?");
    expect(question.responses).toEqual([
      { text: "Veľmi dobrá", theme: "Komunikácia" },
      { text: "Mohlo by byť lepšie", theme: "Bez odpovede" },
      { text: "Rýchla spätná väzba", theme: "Komunikácia" },
      { text: "Chýbajú podklady", theme: "Procesy" },
    ]);
    expect(question.themeCloud).toEqual([
      { theme: "Komunikácia", count: 2, percentage: 50 },
      { theme: "Procesy", count: 1, percentage: 25 },
    ]);
  });

  it("keeps at most 8 themes in themeCloud", () => {
    const answers = Array.from({ length: 9 }, (_, i) => ({
      text: `Odpoveď ${i + 1}`,
      tema: `Téma ${i + 1}`,
    }));

    const result = buildOpenQuestionsFromMap({
      TeamX: { Q1: answers },
    });

    expect(result[0].questions[0].themeCloud).toHaveLength(8);
  });
});

describe("buildAreasFromQuantitative", () => {
  it("builds areas/teams/metrics with scores and optional frequency distributions", () => {
    const frequency: FrequencyDistribution = {
      na: 1,
      one: 2,
      two: 3,
      three: 4,
      four: 5,
      five: 6,
    };

    const questionTeamKey = buildQuestionTeamDistributionKey("id:q1", "Tím Žilina");
    const result = buildAreasFromQuantitative(
      {
        Kultúra: {
          "Spokojnosť s vedením": {
            questionType: "Prierezova",
            questionId: "q1",
            questionKey: "id:q1",
            scores: { "Tím Žilina": 4 },
          },
          "Spokojnosť s nástrojmi": {
            questionType: "Specificka",
            questionId: "",
            questionKey: "id:q2",
            scores: {},
          },
        },
      },
      ["Tím Žilina", "Team B"],
      "grp",
      { [questionTeamKey]: frequency }
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("grp_1");
    expect(result[0].title).toBe("Kultúra");
    expect(result[0].teams).toHaveLength(2);

    const zilinaMetrics = result[0].teams[0].metrics;
    expect(zilinaMetrics).toHaveLength(2);
    expect(zilinaMetrics[0]).toMatchObject({
      category: "Spokojnosť s vedením",
      questionId: "q1",
      questionType: "Prierezova",
      score: 4,
    });
    expect(zilinaMetrics[0].frequencyDistribution).toEqual(frequency);
    expect(zilinaMetrics[0].frequencyDistribution).not.toBe(frequency);
    expect(zilinaMetrics[1]).toMatchObject({
      category: "Spokojnosť s nástrojmi",
      questionId: undefined,
      questionType: "Specificka",
      score: 0,
      frequencyDistribution: undefined,
    });

    const teamBMetrics = result[0].teams[1].metrics;
    expect(teamBMetrics[0].score).toBe(0);
    expect(teamBMetrics[0].frequencyDistribution).toBeUndefined();
  });
});

describe("buildEngagementFromMap", () => {
  it("maps engagement values per team and keeps fallback defaults for missing teams", () => {
    const result = buildEngagementFromMap(["Team A", "Team B", "Team C"], {
      "Team A": { received: 15, sent: 20, interpretation: "Stabilné zapojenie" },
      "Team C": { received: 0, sent: 3, interpretation: "" },
    });

    expect(result).toEqual([
      { name: "Team A", count: 15, totalSent: 20, aiSummary: "Stabilné zapojenie" },
      { name: "Team B", count: 0, totalSent: 0, aiSummary: "" },
      { name: "Team C", count: 0, totalSent: 3, aiSummary: "" },
    ]);
  });
});
