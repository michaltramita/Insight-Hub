import {
  AnalysisMode,
  FeedbackAnalysisResult,
  FrequencyDistribution,
} from "../../types";
import {
  buildQuestionDistributionKey,
  buildQuestionTeamDistributionKey,
  createEmptyFrequencyDistribution,
  normalizeScaleDistributionKey,
} from "../../utils/frequencyDistribution";
import {
  buildAreasFromQuantitative,
  buildEngagementFromMap,
  buildOpenQuestionsFromMap,
  OpenQuestionsMap,
  QuantitativeByOblast,
  TeamEngagementMap,
} from "./builders";
import { inferMetaFromFileName, normalize, toSafeIdToken, warnInDev } from "./shared";

export const analyzeDocument = async (
  inputData: string,
  mode: AnalysisMode,
  isExcel: boolean = false,
  sourceFileName: string = ""
): Promise<FeedbackAnalysisResult> => {
  let calculatedOpenQuestions: any[] = [];
  let calculatedAreas: any[] = [];
  let calculatedEngagement: any[] = [];
  let preparedSurveyGroups: Array<{
    id: string;
    label: string;
    masterTeams: string[];
    teamEngagement: any[];
    areas: any[];
    openQuestions: any[];
  }> = [];
  let totalS = 0;
  let totalR = 0;
  let sucRate = "";

  let clientNameFromExcel = "";
  let surveyNameFromExcel = "";

  if (isExcel && mode === "ZAMESTNANECKA_SPOKOJNOST") {
    try {
      const rawData = JSON.parse(inputData) as any[];

      const firstRowWithMeta =
        rawData.find((row: any) => row.nazov_firmy || row.nazov_prieskumu) || {};
      clientNameFromExcel = String(firstRowWithMeta.nazov_firmy || "").trim();
      surveyNameFromExcel = String(firstRowWithMeta.nazov_prieskumu || "").trim();

      if (!clientNameFromExcel || !surveyNameFromExcel) {
        const inferred = inferMetaFromFileName(sourceFileName);
        if (!clientNameFromExcel && inferred.clientName) {
          clientNameFromExcel = inferred.clientName;
        }
        if (!surveyNameFromExcel && inferred.surveyName) {
          surveyNameFromExcel = inferred.surveyName;
        }
      }

      const openQuestionsMap: OpenQuestionsMap = {};
      const quantitativeByOblast: QuantitativeByOblast = {};
      const frequenciesByQuestionTeam: Record<string, FrequencyDistribution> = {};
      const uniqueTeams = new Set<string>();

      // NOVÉ: Uchovávame si presne hodnoty zapojenia + text z Excelu
      const teamEngagementMap: TeamEngagementMap = {};
      const surveyGroupOrder: string[] = [];
      const surveyGroupOpenQuestionsMap: Record<string, OpenQuestionsMap> = {};
      const surveyGroupQuantitativeByOblast: Record<string, QuantitativeByOblast> = {};
      const surveyGroupFrequenciesByQuestionTeam: Record<
        string,
        Record<string, FrequencyDistribution>
      > = {};
      const surveyGroupUniqueTeams: Record<string, Set<string>> = {};
      const surveyGroupEngagementMap: Record<string, TeamEngagementMap> = {};

      rawData.forEach((row: any) => {
        const team = String(row.skupina || "").trim();
        const surveyGroup = String(row.survey_group || "").trim();
        const isCelkom = normalize(team) === "celkom";
        const hasSurveyGroup = !!surveyGroup;

        if (hasSurveyGroup && !surveyGroupOrder.includes(surveyGroup)) {
          surveyGroupOrder.push(surveyGroup);
          surveyGroupOpenQuestionsMap[surveyGroup] = {};
          surveyGroupQuantitativeByOblast[surveyGroup] = {};
          surveyGroupFrequenciesByQuestionTeam[surveyGroup] = {};
          surveyGroupUniqueTeams[surveyGroup] = new Set<string>();
          surveyGroupEngagementMap[surveyGroup] = {};
        }

        if (team && !isCelkom) uniqueTeams.add(team);
        if (team && !isCelkom && hasSurveyGroup) {
          surveyGroupUniqueTeams[surveyGroup].add(team);
        }

        const rowType = normalize(String(row.typ || ""));
        const questionText = String(row.otazka || "").trim();
        const questionTextLower = normalize(questionText);
        const questionId = String(row.question_id || "").trim();
        const questionKey = buildQuestionDistributionKey(questionId, questionText);
        const oblast = String(row.oblast || "Iné oblasti").trim();
        const oblastNormalized = normalize(oblast);
        const isScaleFrequencyRow =
          rowType.includes("pocetnost") && rowType.includes("skal");

        // --- 1. ODCHYTENIE MANUÁLNEJ INTERPRETÁCIE ---
        if (
          questionTextLower.includes("interpretacia zapojenia") ||
          questionTextLower.includes("interpretácia zapojenia")
        ) {
          if (!teamEngagementMap[team]) {
            teamEngagementMap[team] = { received: 0, sent: 0, interpretation: "" };
          }
          if (hasSurveyGroup && !surveyGroupEngagementMap[surveyGroup][team]) {
            surveyGroupEngagementMap[surveyGroup][team] = {
              received: 0,
              sent: 0,
              interpretation: "",
            };
          }
          // Text odpovede si uložíme do premennej interpretation
          teamEngagementMap[team].interpretation = String(row.text || "").trim();
          if (hasSurveyGroup) {
            surveyGroupEngagementMap[surveyGroup][team].interpretation = String(
              row.text || ""
            ).trim();
          }
          return; // Končíme s týmto riadkom, aby nešiel zbytočne do API ako otvorená otázka
        }

        const rawQuestionType = String(row.kategoria_otazky || "Prierezova").trim();
        const questionType = normalize(rawQuestionType).includes("specif")
          ? "Specificka"
          : "Prierezova";

        // 2. Voľné odpovede
        if (rowType.includes("volna") && row.text?.toString().trim() !== "") {
          const answerText = row.text.toString().trim();
          const answerTheme = String(row.tema_odpovede || "").trim();

          if (team && questionText && !isCelkom) {
            if (!openQuestionsMap[team]) openQuestionsMap[team] = {};
            if (!openQuestionsMap[team][questionText]) {
              openQuestionsMap[team][questionText] = [];
            }
            openQuestionsMap[team][questionText].push({
              text: answerText,
              tema: answerTheme,
            });

            if (hasSurveyGroup) {
              if (!surveyGroupOpenQuestionsMap[surveyGroup][team]) {
                surveyGroupOpenQuestionsMap[surveyGroup][team] = {};
              }
              if (!surveyGroupOpenQuestionsMap[surveyGroup][team][questionText]) {
                surveyGroupOpenQuestionsMap[surveyGroup][team][questionText] = [];
              }
              surveyGroupOpenQuestionsMap[surveyGroup][team][questionText].push({
                text: answerText,
                tema: answerTheme,
              });
            }
          }
          return;
        }

        // 3. Početnosť škály (distribution)
        if (team && questionText && !isCelkom && isScaleFrequencyRow) {
          const scaleKey = normalizeScaleDistributionKey(row.skala_hodnota);
          if (!scaleKey) {
            warnInDev(
              "[Excel import] Ignorujem riadok pocetnost_skaly s neplatnou skala_hodnota.",
              {
                questionId,
                team,
                otazkaText: questionText,
                skala_hodnota: row.skala_hodnota,
              }
            );
            return;
          }

          const rawCount = Number(String(row.hodnota ?? "").replace(",", "."));
          if (!Number.isFinite(rawCount)) {
            warnInDev(
              "[Excel import] Ignorujem riadok pocetnost_skaly s neplatnou hodnotou počtu.",
              {
                questionId,
                team,
                otazkaText: questionText,
                hodnota: row.hodnota,
                skala_hodnota: row.skala_hodnota,
              }
            );
            return;
          }

          const frequencyKey = buildQuestionTeamDistributionKey(questionKey, team);
          if (!frequenciesByQuestionTeam[frequencyKey]) {
            frequenciesByQuestionTeam[frequencyKey] = createEmptyFrequencyDistribution();
          }
          frequenciesByQuestionTeam[frequencyKey][scaleKey] += rawCount;

          if (hasSurveyGroup) {
            if (!surveyGroupFrequenciesByQuestionTeam[surveyGroup][frequencyKey]) {
              surveyGroupFrequenciesByQuestionTeam[surveyGroup][frequencyKey] =
                createEmptyFrequencyDistribution();
            }
            surveyGroupFrequenciesByQuestionTeam[surveyGroup][frequencyKey][scaleKey] +=
              rawCount;
          }

          return;
        }

        // 4. Kvantitatívne údaje a zapojenie
        if (row.hodnota !== undefined && row.hodnota !== null && row.hodnota !== "") {
          const cleanHodnota = String(row.hodnota).replace(",", ".");
          const numericValue = Number(cleanHodnota);

          if (!isNaN(numericValue)) {
            const isEngagement =
              oblastNormalized.includes("zapojenie") ||
              questionTextLower.includes("zapojen") ||
              questionTextLower.includes("ucast") ||
              questionTextLower.includes("navrat") ||
              questionTextLower.includes("osloven") ||
              questionTextLower.includes("rozposlan");

            if (isEngagement) {
              if (isCelkom) {
                if (
                  questionTextLower.includes("rozposlan") ||
                  questionTextLower.includes("osloven")
                ) {
                  totalS = numericValue;
                } else if (questionTextLower.includes("navrat")) {
                  sucRate = `${numericValue}%`;
                } else {
                  totalR = numericValue;
                }
              } else {
                if (!teamEngagementMap[team]) {
                  teamEngagementMap[team] = { received: 0, sent: 0, interpretation: "" };
                }
                if (hasSurveyGroup && !surveyGroupEngagementMap[surveyGroup][team]) {
                  surveyGroupEngagementMap[surveyGroup][team] = {
                    received: 0,
                    sent: 0,
                    interpretation: "",
                  };
                }

                if (
                  questionTextLower.includes("osloven") ||
                  questionTextLower.includes("rozposlan")
                ) {
                  teamEngagementMap[team].sent = numericValue;
                  if (hasSurveyGroup) {
                    surveyGroupEngagementMap[surveyGroup][team].sent = numericValue;
                  }
                } else if (
                  questionTextLower.includes("struktura") ||
                  questionTextLower.includes("vyplnen") ||
                  questionTextLower.includes("zapojen")
                ) {
                  teamEngagementMap[team].received = numericValue;
                  if (hasSurveyGroup) {
                    surveyGroupEngagementMap[surveyGroup][team].received = numericValue;
                  }
                }
              }
              return;
            }

            if (team && questionText && !isCelkom && rowType.includes("skore")) {
              if (!quantitativeByOblast[oblast]) quantitativeByOblast[oblast] = {};
              if (!quantitativeByOblast[oblast][questionText]) {
                quantitativeByOblast[oblast][questionText] = {
                  questionType,
                  questionId,
                  questionKey,
                  scores: {},
                };
              }
              if (!quantitativeByOblast[oblast][questionText].questionId && questionId) {
                quantitativeByOblast[oblast][questionText].questionId = questionId;
                quantitativeByOblast[oblast][questionText].questionKey =
                  buildQuestionDistributionKey(questionId, questionText);
              }
              quantitativeByOblast[oblast][questionText].scores[team] = numericValue;

              if (hasSurveyGroup) {
                if (!surveyGroupQuantitativeByOblast[surveyGroup][oblast]) {
                  surveyGroupQuantitativeByOblast[surveyGroup][oblast] = {};
                }
                if (!surveyGroupQuantitativeByOblast[surveyGroup][oblast][questionText]) {
                  surveyGroupQuantitativeByOblast[surveyGroup][oblast][questionText] = {
                    questionType,
                    questionId,
                    questionKey,
                    scores: {},
                  };
                }
                if (
                  !surveyGroupQuantitativeByOblast[surveyGroup][oblast][questionText]
                    .questionId &&
                  questionId
                ) {
                  surveyGroupQuantitativeByOblast[surveyGroup][oblast][
                    questionText
                  ].questionId = questionId;
                  surveyGroupQuantitativeByOblast[surveyGroup][oblast][
                    questionText
                  ].questionKey = buildQuestionDistributionKey(questionId, questionText);
                }
                surveyGroupQuantitativeByOblast[surveyGroup][oblast][questionText].scores[
                  team
                ] = numericValue;
              }
            }
          }
        }
      });

      const globalTeams = Array.from(uniqueTeams);
      calculatedOpenQuestions = buildOpenQuestionsFromMap(openQuestionsMap);
      calculatedAreas = buildAreasFromQuantitative(
        quantitativeByOblast,
        globalTeams,
        "area",
        frequenciesByQuestionTeam
      );
      calculatedEngagement = buildEngagementFromMap(globalTeams, teamEngagementMap);

      if (totalS <= 0) {
        totalS = calculatedEngagement.reduce(
          (sum, team) => sum + (Number(team.totalSent) || 0),
          0
        );
      }
      if (totalR <= 0) {
        totalR = calculatedEngagement.reduce(
          (sum, team) => sum + (Number(team.count) || 0),
          0
        );
      }
      if (!sucRate) {
        sucRate = totalS > 0 ? `${((totalR / totalS) * 100).toFixed(1)}%` : "0%";
      }

      preparedSurveyGroups = surveyGroupOrder.map((groupName, groupIndex) => {
        const groupTeams = Array.from(surveyGroupUniqueTeams[groupName] || []);
        const groupId = `${toSafeIdToken(groupName)}_${groupIndex + 1}`;

        return {
          id: groupId,
          label: groupName,
          masterTeams: groupTeams,
          teamEngagement: buildEngagementFromMap(
            groupTeams,
            surveyGroupEngagementMap[groupName] || {}
          ),
          areas: buildAreasFromQuantitative(
            surveyGroupQuantitativeByOblast[groupName] || {},
            groupTeams,
            `${groupId}_area`,
            surveyGroupFrequenciesByQuestionTeam[groupName] || {}
          ),
          openQuestions: buildOpenQuestionsFromMap(
            surveyGroupOpenQuestionsMap[groupName] || {}
          ),
        };
      });
    } catch (error) {
      console.warn("Chyba pri lokálnom spracovaní:", error);
    }
  }

  const normalizedSurveyGroups = preparedSurveyGroups.map((group) => ({
    id: group.id,
    label: group.label,
    masterTeams: group.masterTeams,
    teamEngagement: group.teamEngagement,
    openQuestions: group.openQuestions,
    areas: group.areas,
  }));

  return {
    mode: "ZAMESTNANECKA_SPOKOJNOST",
    reportMetadata: { date: new Date().getFullYear().toString(), scaleMax: 5 },
    satisfaction: {
      clientName: clientNameFromExcel || "Neznáma firma",
      surveyName: surveyNameFromExcel || "Report z prieskumu",
      totalSent: totalS,
      totalReceived: totalR,
      successRate: sucRate || "0%",
      teamEngagement: calculatedEngagement, // Vraciame presne to, čo sme prečítali z Excelu
      openQuestions: calculatedOpenQuestions,
      areas: calculatedAreas || [],
      surveyGroups:
        normalizedSurveyGroups.length > 0 ? normalizedSurveyGroups : undefined,
    },
  } as FeedbackAnalysisResult;
};
