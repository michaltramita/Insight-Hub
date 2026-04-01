import { FrequencyDistribution, OpenQuestionTeam, SatisfactionArea } from "../../types";
import { buildQuestionTeamDistributionKey } from "../../utils/frequencyDistribution";
import { isExcludedTheme } from "./shared";

export type OpenQuestionsMap = Record<
  string,
  Record<string, Array<{ text: string; tema: string }>>
>;

export type QuantitativeByOblast = Record<
  string,
  Record<
    string,
    {
      questionType: string;
      questionId: string;
      questionKey: string;
      scores: Record<string, number>;
    }
  >
>;

export type TeamEngagementMap = Record<
  string,
  { received: number; sent: number; interpretation: string }
>;

export type EngagementSummary = {
  name: string;
  count: number;
  totalSent: number;
  aiSummary: string;
};

export const buildOpenQuestionsFromMap = (
  openQuestionsMap: OpenQuestionsMap
): OpenQuestionTeam[] =>
  Object.entries(openQuestionsMap).map(([teamName, questionsByText]) => ({
    teamName,
    questions: Object.entries(questionsByText).map(([questionText, answers]) => {
      const responses = (Array.isArray(answers) ? answers : [])
        .map((answer) => ({
          text: String(answer?.text || "").trim(),
          theme: String(answer?.tema || "").trim(),
        }))
        .filter((answer) => answer.text.length > 0)
        .map((answer) => ({
          text: answer.text,
          theme: answer.theme || undefined,
        }));

      const totalAnswers = responses.length;
      const themeCounter: Record<string, number> = {};

      responses.forEach((answer) => {
        const theme = String(answer.theme || "").trim();
        if (!theme || isExcludedTheme(theme)) return;
        themeCounter[theme] = (themeCounter[theme] || 0) + 1;
      });

      const themeCloud = Object.entries(themeCounter)
        .map(([theme, count]) => ({
          theme,
          count,
          percentage:
            totalAnswers > 0 ? Number(((count / totalAnswers) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      return {
        questionText: String(questionText || "").trim(),
        themeCloud,
        responses,
      };
    }),
  }));

export const buildAreasFromQuantitative = (
  quantitativeByOblast: QuantitativeByOblast,
  teams: string[],
  idPrefix: string,
  frequenciesByQuestionTeam: Record<string, FrequencyDistribution> = {}
): SatisfactionArea[] =>
  Object.entries(quantitativeByOblast).map(([oblastName, questionsInOblast], index) => ({
    id: `${idPrefix}_${index + 1}`,
    title: oblastName,
    teams: teams.map((teamName) => ({
      teamName,
      metrics: Object.entries(questionsInOblast).map(([questionText, questionData]) => ({
        questionId: questionData.questionId || undefined,
        category: questionText,
        score: questionData.scores[teamName] || 0,
        questionType: questionData.questionType,
        frequencyDistribution: (() => {
          const key = buildQuestionTeamDistributionKey(questionData.questionKey, teamName);
          const distribution = frequenciesByQuestionTeam[key];
          return distribution ? { ...distribution } : undefined;
        })(),
      })),
    })),
  }));

export const buildEngagementFromMap = (
  teams: string[],
  teamEngagementMap: TeamEngagementMap
): EngagementSummary[] =>
  teams.map((teamName) => ({
    name: teamName,
    count: teamEngagementMap[teamName]?.received || 0,
    totalSent: teamEngagementMap[teamName]?.sent || 0,
    aiSummary: teamEngagementMap[teamName]?.interpretation || "",
  }));
