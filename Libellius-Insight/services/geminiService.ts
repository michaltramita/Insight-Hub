import { CellValue, Workbook } from "exceljs";
import * as Papa from "papaparse";
import {
  FeedbackAnalysisResult,
  AnalysisMode,
  FrequencyDistribution,
} from "../types";
import {
  buildQuestionDistributionKey,
  buildQuestionTeamDistributionKey,
  createEmptyFrequencyDistribution,
  normalizeScaleDistributionKey,
} from "../utils/frequencyDistribution";

const MAX_EXCEL_FILE_BYTES = 12 * 1024 * 1024;
const MAX_EXCEL_ROWS = 15000;
const MAX_EXCEL_COLUMNS = 120;
const MAX_EXCEL_CELLS = 600000;
const MAX_TEXT_FIELD_LENGTH = 2000;
const MAX_HEADER_LENGTH = 120;
const MAX_ERROR_MESSAGE_LENGTH = 240;

const hasOwn = (obj: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

const clampString = (value: unknown, maxLength = MAX_TEXT_FIELD_LENGTH) =>
  String(value ?? "").trim().slice(0, maxLength);

const clampErrorMessage = (value: unknown) =>
  clampString(value, MAX_ERROR_MESSAGE_LENGTH);

const ensureSpreadsheetLimits = (rowCount: number, columnCount: number) => {
  const safeRows = Math.max(0, rowCount);
  const safeColumns = Math.max(0, columnCount);
  const cellCount = safeRows * safeColumns;

  if (safeRows > MAX_EXCEL_ROWS) {
    throw new Error(
      `Excel/CSV obsahuje príliš veľa riadkov (${safeRows}). Maximum je ${MAX_EXCEL_ROWS}.`
    );
  }
  if (safeColumns > MAX_EXCEL_COLUMNS) {
    throw new Error(
      `Excel/CSV obsahuje príliš veľa stĺpcov (${safeColumns}). Maximum je ${MAX_EXCEL_COLUMNS}.`
    );
  }
  if (cellCount > MAX_EXCEL_CELLS) {
    throw new Error(
      `Excel/CSV obsahuje príliš veľa buniek (${cellCount}). Maximum je ${MAX_EXCEL_CELLS}.`
    );
  }
};

const normalizeHeaderName = (value: unknown, fallback: string, used: Set<string>) => {
  const base = clampString(value, MAX_HEADER_LENGTH) || fallback;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}_${suffix++}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const toPlainCellValue = (value: CellValue): unknown => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return clampString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) {
      return toPlainCellValue(value.result as CellValue);
    }
    if ("text" in value && typeof value.text === "string") {
      return clampString(value.text);
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return clampString(value.richText.map((chunk) => chunk?.text ?? "").join(""));
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return clampString(value.hyperlink);
    }
    if ("error" in value && typeof value.error === "string") {
      return clampString(value.error);
    }
  }

  return clampString(value);
};

const mapRowsToSimplifiedData = (rows: Record<string, unknown>[]) =>
  rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      question_id: readStringField(row, [
        "question_id",
        "Question_id",
        "question id",
        "Question ID",
        "id_otazky",
        "Id_otazky",
        "ID_otazky",
      ]),
      skupina: readStringField(row, ["skupina", "Skupina"]),
      survey_group: readStringField(row, [
        "survey_group",
        "Survey_group",
        "survey_skupina",
        "Survey_skupina",
        "survey group",
        "Survey group",
      ]),
      otazka: readStringField(row, ["otazka", "Otazka"]),
      hodnota: readRawField(row, ["hodnota", "Hodnota"], ""),
      text: readStringField(row, ["text_odpovede", "Text_odpovede"]),
      oblast: readStringField(row, ["oblast", "Oblast"], "Nezaradené"),
      typ: readStringField(row, ["typ", "Typ"]),
      kategoria_otazky: readStringField(
        row,
        ["kategoria_otazky", "Kategoria_otazky"],
        "Prierezova"
      ),
      nazov_firmy: readStringField(row, [
        "nazov_firmy",
        "Nazov_firmy",
        "názov_firmy",
        "Názov_firmy",
        "nazov firmy",
        "Nazov firmy",
        "Názov firmy",
        "firma",
        "Firma",
      ]),
      nazov_prieskumu: readStringField(row, [
        "nazov_prieskumu",
        "Nazov_prieskumu",
        "názov_prieskumu",
        "Názov_prieskumu",
        "nazov prieskumu",
        "Nazov prieskumu",
        "Názov prieskumu",
        "prieskum",
        "Prieskum",
      ]),
      tema_odpovede: readStringField(row, [
        "tema_odpovede",
        "Tema_odpovede",
        "label_temy",
        "Label_temy",
      ]),
      skala_hodnota: readRawField(
        row,
        ["skala_hodnota", "Skala_hodnota", "skala hodnota", "Skala hodnota"],
        null
      ),
    }));

// Bezpečná normalizácia textu
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const isExcludedTheme = (theme: string) => {
  const normalized = normalize(String(theme || ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");
  return compact === "bezodpovede" || compact === "bezodpovedi";
};

const readStringField = (row: Record<string, unknown>, keys: string[], fallback = "") => {
  for (const key of keys) {
    if (!hasOwn(row, key)) continue;
    const value = row[key];
    if (value === undefined || value === null) continue;
    const text = clampString(value);
    if (text) return text;
  }
  return fallback;
};

const readRawField = (row: Record<string, unknown>, keys: string[], fallback: any = "") => {
  for (const key of keys) {
    if (!hasOwn(row, key)) continue;
    const value = row[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string") return clampString(value);
    return value;
  }
  return fallback;
};

const warnInDev = (...args: any[]) => {
  if ((import.meta as any)?.env?.DEV) {
    console.warn(...args);
  }
};

const inferMetaFromFileName = (sourceFileName: string) => {
  const fileName = String(sourceFileName || "").trim();
  if (!fileName) return { clientName: "", surveyName: "" };

  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  const base = withoutExt.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  let candidate = base.replace(/\s+insighthub\b.*$/i, "").trim();
  if (!candidate) candidate = base;

  candidate = candidate
    .replace(/\s+v\d+\b.*$/i, "")
    .replace(/\s+survey\s*group\b.*$/i, "")
    .trim();

  const clientName = candidate.length >= 3 ? candidate : "";
  const surveyName = clientName
    ? `Prieskum spokojnosti zamestnancov spoločnosti ${clientName}`
    : "";

  return { clientName, surveyName };
};

const toSafeIdToken = (value: string) => {
  const normalized = normalize(String(value || ""));
  const token = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return token || "group";
};

const buildOpenQuestionsFromMap = (
  openQsMap: Record<string, Record<string, Array<{ text: string; tema: string }>>>
) =>
  Object.entries(openQsMap).map(([teamName, qs]) => ({
    teamName,
    questions: Object.entries(qs).map(([questionText, answers]) => {
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
            totalAnswers > 0
              ? Number(((count / totalAnswers) * 100).toFixed(1))
              : 0,
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

const buildAreasFromQuantitative = (
  quantitativeByOblast: Record<
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
  >,
  teams: string[],
  idPrefix: string,
  frequenciesByQuestionTeam: Record<string, FrequencyDistribution> = {}
) =>
  Object.entries(quantitativeByOblast).map(([oblastName, questionsInOblast], index) => ({
    id: `${idPrefix}_${index + 1}`,
    title: oblastName,
    teams: teams.map((teamName) => ({
      teamName,
      metrics: Object.entries(questionsInOblast).map(([qText, qData]) => ({
        questionId: qData.questionId || undefined,
        category: qText,
        score: qData.scores[teamName] || 0,
        questionType: qData.questionType,
        frequencyDistribution: (() => {
          const key = buildQuestionTeamDistributionKey(qData.questionKey, teamName);
          const distribution = frequenciesByQuestionTeam[key];
          return distribution ? { ...distribution } : undefined;
        })(),
      })),
    })),
  }));

const buildEngagementFromMap = (
  teams: string[],
  teamEngagementMap: Record<string, { received: number; sent: number; interpretation: string }>
) =>
  teams.map((teamName) => ({
    name: teamName,
    count: teamEngagementMap[teamName]?.received || 0,
    totalSent: teamEngagementMap[teamName]?.sent || 0,
    aiSummary: teamEngagementMap[teamName]?.interpretation || "",
  }));

export const parseExcelFile = async (file: File): Promise<string> => {
  if (!file || file.size <= 0) {
    throw new Error("Súbor je prázdny.");
  }
  if (file.size > MAX_EXCEL_FILE_BYTES) {
    throw new Error("Excel/CSV súbor je príliš veľký (max. 12 MB).");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (extension === "xls") {
    throw new Error("Formát .xls už nepodporujeme. Uložte súbor ako .xlsx alebo .csv.");
  }
  if (extension !== "xlsx" && extension !== "csv") {
    throw new Error("Podporované sú iba súbory .xlsx a .csv.");
  }

  try {
    let rows: Record<string, unknown>[] = [];

    if (extension === "csv") {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header) => clampString(header, MAX_HEADER_LENGTH),
      });

      if (parsed.errors.length > 0) {
        const firstError = parsed.errors[0];
        throw new Error(
          `CSV súbor sa nepodarilo načítať: ${clampErrorMessage(
            firstError?.message || "neznáma chyba"
          )}`
        );
      }

      const columnCount = parsed.meta.fields?.length || 0;
      const rowCount = parsed.data.length + (columnCount > 0 ? 1 : 0);
      ensureSpreadsheetLimits(rowCount, columnCount);
      rows = parsed.data;
    } else {
      const workbook = new Workbook();
      const data = await file.arrayBuffer();
      await workbook.xlsx.load(data);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new Error("Súbor neobsahuje žiadny hárok.");
      }

      const rowCount = sheet.actualRowCount;
      const columnCount = sheet.actualColumnCount;
      if (rowCount <= 0 || columnCount <= 0) {
        throw new Error("Prvý hárok neobsahuje čitateľné dáta.");
      }

      ensureSpreadsheetLimits(rowCount, columnCount);

      const usedHeaders = new Set<string>();
      const headerRow = sheet.getRow(1);
      const headers = Array.from({ length: columnCount }, (_, colIndex) =>
        normalizeHeaderName(
          toPlainCellValue(headerRow.getCell(colIndex + 1).value as CellValue),
          `column_${colIndex + 1}`,
          usedHeaders
        )
      );

      const parsedRows: Record<string, unknown>[] = [];
      for (let rowIndex = 2; rowIndex <= rowCount; rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        const parsedRow: Record<string, unknown> = {};
        let hasAnyValue = false;

        for (let colIndex = 1; colIndex <= columnCount; colIndex += 1) {
          const headerName = headers[colIndex - 1];
          if (!headerName) continue;

          const value = toPlainCellValue(row.getCell(colIndex).value as CellValue);
          if (value !== null && value !== "") {
            hasAnyValue = true;
          }
          parsedRow[headerName] = value;
        }

        if (hasAnyValue) {
          parsedRows.push(parsedRow);
        }
      }

      rows = parsedRows;
    }

    return JSON.stringify(mapRowsToSimplifiedData(rows));
  } catch (err) {
    throw err instanceof Error
      ? err
      : new Error("Nepodarilo sa prečítať Excel/CSV súbor.");
  }
};

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
      const rawData = JSON.parse(inputData);

      const firstRowWithMeta = rawData.find((r: any) => r.nazov_firmy || r.nazov_prieskumu) || {};
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

      const openQsMap: Record<
        string,
        Record<string, Array<{ text: string; tema: string }>>
      > = {};
      const quantitativeByOblast: Record<
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
      > = {};
      const frequenciesByQuestionTeam: Record<string, FrequencyDistribution> = {};
      const uniqueTeams = new Set<string>();
      
      // NOVÉ: Uchovávame si presne hodnoty zapojenia + text z Excelu
      const teamEngagementMap: Record<string, { received: number; sent: number; interpretation: string }> = {};
      const surveyGroupOrder: string[] = [];
      const surveyGroupOpenQsMap: Record<
        string,
        Record<string, Record<string, Array<{ text: string; tema: string }>>>
      > = {};
      const surveyGroupQuantitativeByOblast: Record<
        string,
        Record<
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
        >
      > = {};
      const surveyGroupFrequenciesByQuestionTeam: Record<
        string,
        Record<string, FrequencyDistribution>
      > = {};
      const surveyGroupUniqueTeams: Record<string, Set<string>> = {};
      const surveyGroupEngagementMap: Record<
        string,
        Record<string, { received: number; sent: number; interpretation: string }>
      > = {};

      rawData.forEach((row: any) => {
        const team = String(row.skupina || "").trim();
        const surveyGroup = String(row.survey_group || "").trim();
        const isCelkom = normalize(team) === "celkom";
        const hasSurveyGroup = !!surveyGroup;

        if (hasSurveyGroup && !surveyGroupOrder.includes(surveyGroup)) {
          surveyGroupOrder.push(surveyGroup);
          surveyGroupOpenQsMap[surveyGroup] = {};
          surveyGroupQuantitativeByOblast[surveyGroup] = {};
          surveyGroupFrequenciesByQuestionTeam[surveyGroup] = {};
          surveyGroupUniqueTeams[surveyGroup] = new Set<string>();
          surveyGroupEngagementMap[surveyGroup] = {};
        }

        if (team && !isCelkom) uniqueTeams.add(team);
        if (team && !isCelkom && hasSurveyGroup) {
          surveyGroupUniqueTeams[surveyGroup].add(team);
        }

        const rowTyp = normalize(String(row.typ || ""));
        const otazkaText = String(row.otazka || "").trim();
        const otazkaTextLower = normalize(otazkaText);
        const questionId = String(row.question_id || "").trim();
        const questionKey = buildQuestionDistributionKey(questionId, otazkaText);
        const oblast = String(row.oblast || "Iné oblasti").trim();
        const oblastNorm = normalize(oblast);
        const isScaleFrequencyRow =
          rowTyp.includes("pocetnost") && rowTyp.includes("skal");
        
        // --- 1. ODCHYTENIE MANUÁLNEJ INTERPRETÁCIE ---
        if (otazkaTextLower.includes("interpretacia zapojenia") || otazkaTextLower.includes("interpretácia zapojenia")) {
            if (!teamEngagementMap[team]) teamEngagementMap[team] = { received: 0, sent: 0, interpretation: "" };
            if (hasSurveyGroup && !surveyGroupEngagementMap[surveyGroup][team]) {
              surveyGroupEngagementMap[surveyGroup][team] = { received: 0, sent: 0, interpretation: "" };
            }
            // Text odpovede si uložíme do premennej interpretation
            teamEngagementMap[team].interpretation = String(row.text || "").trim();
            if (hasSurveyGroup) {
              surveyGroupEngagementMap[surveyGroup][team].interpretation = String(row.text || "").trim();
            }
            return; // Končíme s týmto riadkom, aby nešiel zbytočne do API ako otvorená otázka
        }

        const rawQuestionType = String(row.kategoria_otazky || "Prierezova").trim();
        const qType = normalize(rawQuestionType).includes("specif") ? "Specificka" : "Prierezova";

        // 2. Voľné odpovede
        if (rowTyp.includes("volna") && row.text?.toString().trim() !== "") {
          const ansText = row.text.toString().trim();
          const ansTema = String(row.tema_odpovede || "").trim();

          if (team && otazkaText && !isCelkom) {
            if (!openQsMap[team]) openQsMap[team] = {};
            if (!openQsMap[team][otazkaText]) openQsMap[team][otazkaText] = [];
            openQsMap[team][otazkaText].push({ text: ansText, tema: ansTema });

            if (hasSurveyGroup) {
              if (!surveyGroupOpenQsMap[surveyGroup][team]) surveyGroupOpenQsMap[surveyGroup][team] = {};
              if (!surveyGroupOpenQsMap[surveyGroup][team][otazkaText]) {
                surveyGroupOpenQsMap[surveyGroup][team][otazkaText] = [];
              }
              surveyGroupOpenQsMap[surveyGroup][team][otazkaText].push({
                text: ansText,
                tema: ansTema,
              });
            }
          }
          return;
        }

        // 3. Početnosť škály (distribution)
        if (team && otazkaText && !isCelkom && isScaleFrequencyRow) {
          const scaleKey = normalizeScaleDistributionKey(row.skala_hodnota);
          if (!scaleKey) {
            warnInDev(
              "[Excel import] Ignorujem riadok pocetnost_skaly s neplatnou skala_hodnota.",
              {
                questionId,
                team,
                otazkaText,
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
                otazkaText,
                hodnota: row.hodnota,
                skala_hodnota: row.skala_hodnota,
              }
            );
            return;
          }

          const freqKey = buildQuestionTeamDistributionKey(questionKey, team);
          if (!frequenciesByQuestionTeam[freqKey]) {
            frequenciesByQuestionTeam[freqKey] = createEmptyFrequencyDistribution();
          }
          frequenciesByQuestionTeam[freqKey][scaleKey] += rawCount;

          if (hasSurveyGroup) {
            if (!surveyGroupFrequenciesByQuestionTeam[surveyGroup][freqKey]) {
              surveyGroupFrequenciesByQuestionTeam[surveyGroup][freqKey] =
                createEmptyFrequencyDistribution();
            }
            surveyGroupFrequenciesByQuestionTeam[surveyGroup][freqKey][scaleKey] +=
              rawCount;
          }

          return;
        }

        // 4. Kvantitatívne údaje a zapojenie
        if (row.hodnota !== undefined && row.hodnota !== null && row.hodnota !== "") {
          const cleanHodnota = String(row.hodnota).replace(",", ".");
          const val = Number(cleanHodnota);

          if (!isNaN(val)) {
            const jeUcast =
              oblastNorm.includes("zapojenie") ||
              otazkaTextLower.includes("zapojen") ||
              otazkaTextLower.includes("ucast") ||
              otazkaTextLower.includes("navrat") ||
              otazkaTextLower.includes("osloven") ||
              otazkaTextLower.includes("rozposlan");

            if (jeUcast) {
              if (isCelkom) {
                if (otazkaTextLower.includes("rozposlan") || otazkaTextLower.includes("osloven")) {
                  totalS = val;
                } else if (otazkaTextLower.includes("navrat")) {
                  sucRate = `${val}%`;
                } else {
                  totalR = val;
                }
              } else {
                if (!teamEngagementMap[team]) teamEngagementMap[team] = { received: 0, sent: 0, interpretation: "" };
                if (hasSurveyGroup && !surveyGroupEngagementMap[surveyGroup][team]) {
                  surveyGroupEngagementMap[surveyGroup][team] = { received: 0, sent: 0, interpretation: "" };
                }
                
                if (otazkaTextLower.includes("osloven") || otazkaTextLower.includes("rozposlan")) {
                  teamEngagementMap[team].sent = val;
                  if (hasSurveyGroup) surveyGroupEngagementMap[surveyGroup][team].sent = val;
                } else if (otazkaTextLower.includes("struktura") || otazkaTextLower.includes("vyplnen") || otazkaTextLower.includes("zapojen")) {
                  teamEngagementMap[team].received = val; 
                  if (hasSurveyGroup) surveyGroupEngagementMap[surveyGroup][team].received = val;
                }
              }
              return;
            }

            if (team && otazkaText && !isCelkom && rowTyp.includes("skore")) {
              if (!quantitativeByOblast[oblast]) quantitativeByOblast[oblast] = {};
              if (!quantitativeByOblast[oblast][otazkaText]) {
                quantitativeByOblast[oblast][otazkaText] = {
                  questionType: qType,
                  questionId,
                  questionKey,
                  scores: {},
                };
              }
              if (
                !quantitativeByOblast[oblast][otazkaText].questionId &&
                questionId
              ) {
                quantitativeByOblast[oblast][otazkaText].questionId = questionId;
                quantitativeByOblast[oblast][otazkaText].questionKey =
                  buildQuestionDistributionKey(questionId, otazkaText);
              }
              quantitativeByOblast[oblast][otazkaText].scores[team] = val;

              if (hasSurveyGroup) {
                if (!surveyGroupQuantitativeByOblast[surveyGroup][oblast]) {
                  surveyGroupQuantitativeByOblast[surveyGroup][oblast] = {};
                }
                if (!surveyGroupQuantitativeByOblast[surveyGroup][oblast][otazkaText]) {
                  surveyGroupQuantitativeByOblast[surveyGroup][oblast][otazkaText] = {
                    questionType: qType,
                    questionId,
                    questionKey,
                    scores: {},
                  };
                }
                if (
                  !surveyGroupQuantitativeByOblast[surveyGroup][oblast][otazkaText]
                    .questionId &&
                  questionId
                ) {
                  surveyGroupQuantitativeByOblast[surveyGroup][oblast][
                    otazkaText
                  ].questionId = questionId;
                  surveyGroupQuantitativeByOblast[surveyGroup][oblast][
                    otazkaText
                  ].questionKey = buildQuestionDistributionKey(questionId, otazkaText);
                }
                surveyGroupQuantitativeByOblast[surveyGroup][oblast][otazkaText].scores[team] = val;
              }
            }
          }
        }
      });

      const globalTeams = Array.from(uniqueTeams);
      calculatedOpenQuestions = buildOpenQuestionsFromMap(openQsMap);
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
            surveyGroupOpenQsMap[groupName] || {}
          ),
        };
      });
    } catch (e) {
      console.warn("Chyba pri lokálnom spracovaní:", e);
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
      surveyGroups: normalizedSurveyGroups.length > 0 ? normalizedSurveyGroups : undefined,
    },
  } as FeedbackAnalysisResult;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
  });
};
