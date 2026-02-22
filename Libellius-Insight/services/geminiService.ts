import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// Bezpečná normalizácia textu (odstráni diakritiku a zmení na malé písmená)
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Normalizácia AI payloadu pre OPEN QUESTIONS (nová štruktúra)
// themeCloud má byť na úrovni otázky, nie odporúčania
const normalizeOpenQuestionsPayload = (payload: any) => {
  const safe = Array.isArray(payload?.openQuestions) ? payload.openQuestions : [];

  return safe.map((team: any) => ({
    teamName: String(team?.teamName || "").trim(),
    questions: Array.isArray(team?.questions)
      ? team.questions.map((q: any) => ({
          questionText: String(q?.questionText || "").trim(),

          // NOVÁ LOGIKA: themeCloud je na úrovni otázky
          themeCloud: Array.isArray(q?.themeCloud)
            ? q.themeCloud
                .filter((t: any) => t?.theme)
                .map((t: any) => ({
                  theme: String(t.theme || "").trim(),
                  count: Number(t.count) || 0,
                  percentage: Number(t.percentage) || 0,
                }))
                .sort((a: any, b: any) => b.count - a.count)
            : [],

          recommendations: Array.isArray(q?.recommendations)
            ? q.recommendations.slice(0, 3).map((rec: any) => ({
                title: String(rec?.title || "Odporúčanie").trim(),
                description: String(rec?.description || "").trim(),
                quotes: Array.isArray(rec?.quotes)
                  ? rec.quotes
                      .map((x: any) => String(x || "").trim())
                      .filter(Boolean)
                      .slice(0, 5)
                  : [],
              }))
            : [],
        }))
      : [],
  }));
};

export const parseExcelFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const simplifiedData = jsonData.map((row) => ({
          skupina: String(row["skupina"] || row["Skupina"] || "").trim(),
          otazka: String(row["otazka"] || row["Otazka"] || "").trim(),
          hodnota: row["hodnota"] ?? row["Hodnota"] ?? "",
          text: String(row["text_odpovede"] || row["Text_odpovede"] || "").trim(),
          oblast: String(row["oblast"] || row["Oblast"] || "Nezaradené").trim(),
          typ: String(row["typ"] || row["Typ"] || "").trim(),
          kategoria_otazky: String(
            row["kategoria_otazky"] || row["Kategoria_otazky"] || "Prierezova"
          ).trim(),

          // META polia pre header reportu
          nazov_firmy: String(
            row["nazov_firmy"] ||
              row["Nazov_firmy"] ||
              row["Názov_firmy"] ||
              row["firma"] ||
              row["Firma"] ||
              ""
          ).trim(),
          nazov_prieskumu: String(
            row["nazov_prieskumu"] ||
              row["Nazov_prieskumu"] ||
              row["Názov_prieskumu"] ||
              row["prieskum"] ||
              row["Prieskum"] ||
              ""
          ).trim(),

          // TÉMA / LABEL voľnej odpovede (pre theme cloud a počty)
          tema_odpovede: String(
            row["tema_odpovede"] ||
              row["Tema_odpovede"] ||
              row["téma_odpovede"] ||
              row["Téma_odpovede"] ||
              row["label_temy"] ||
              row["Label_temy"] ||
              row["tema"] ||
              row["Tema"] ||
              ""
          ).trim(),
        }));

        resolve(JSON.stringify(simplifiedData));
      } catch (err) {
        reject(new Error("Nepodarilo sa prečítať Excel súbor."));
      }
    };

    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

export const analyzeDocument = async (
  inputData: string,
  mode: AnalysisMode,
  isExcel: boolean = false
): Promise<FeedbackAnalysisResult> => {
  let rawOpenQuestionsForAI: any[] = [];
  let calculatedAreas: any[] = [];
  let calculatedEngagement: any[] = [];
  let totalS = 0;
  let totalR = 0;
  let sucRate = "";

  // META pre header (firma + názov prieskumu)
  let clientNameFromExcel = "";
  let surveyNameFromExcel = "";

  if (isExcel && mode === "ZAMESTNANECKA_SPOKOJNOST") {
    try {
      const rawData = JSON.parse(inputData);

      // Vytiahni meta údaje z prvého riadku, kde existujú
      const firstRowWithMeta =
        rawData.find((r: any) => r.nazov_firmy || r.nazov_prieskumu) || {};
      clientNameFromExcel = String(firstRowWithMeta.nazov_firmy || "").trim();
      surveyNameFromExcel = String(firstRowWithMeta.nazov_prieskumu || "").trim();

      // openQsMap[team][question] = [{ text, tema }]
      const openQsMap: Record<
        string,
        Record<string, Array<{ text: string; tema: string }>>
      > = {};

      const quantitativeByOblast: Record<
        string,
        Record<string, { questionType: string; scores: Record<string, number> }>
      > = {};

      const uniqueTeams = new Set<string>();
      const teamEngagementMap: Record<string, number> = {};

      rawData.forEach((row: any) => {
        const team = String(row.skupina || "").trim();
        const isCelkom = normalize(team) === "celkom";

        if (team && !isCelkom) uniqueTeams.add(team);

        const rowTyp = normalize(String(row.typ || ""));
        const otazkaText = String(row.otazka || "").trim();
        const otazkaTextLower = normalize(otazkaText);
        const oblast = String(row.oblast || "Iné oblasti").trim();
        const oblastNorm = normalize(oblast);

        const rawQuestionType = String(row.kategoria_otazky || "Prierezova").trim();
        const normQType = normalize(rawQuestionType);
        const qType = normQType.includes("specif") ? "Specificka" : "Prierezova";

        // 1. Voľné odpovede (text + tema)
        if (rowTyp.includes("volna") && row.text?.toString().trim() !== "") {
          const ansText = row.text.toString().trim();
          const ansTema = String(row.tema_odpovede || "").trim();

          if (team && otazkaText && !isCelkom) {
            if (!openQsMap[team]) openQsMap[team] = {};
            if (!openQsMap[team][otazkaText]) openQsMap[team][otazkaText] = [];

            openQsMap[team][otazkaText].push({
              text: ansText,
              tema: ansTema,
            });
          }
          return;
        }

        // 2. Kvantitatívne údaje
        if (row.hodnota !== undefined && row.hodnota !== null && row.hodnota !== "") {
          const cleanHodnota = String(row.hodnota).replace(",", ".");
          const val = Number(cleanHodnota);

          if (!isNaN(val)) {
            // A. Extrakcia ÚČASTI (Zapojenie)
            const jeUcast =
              oblastNorm.includes("zapojenie") ||
              otazkaTextLower.includes("zapojen") ||
              otazkaTextLower.includes("ucast") ||
              otazkaTextLower.includes("účasť") ||
              otazkaTextLower.includes("respondent") ||
              otazkaTextLower.includes("odpovedal") ||
              otazkaTextLower.includes("navrat") ||
              otazkaTextLower.includes("návrat") ||
              otazkaTextLower.includes("osloven") ||
              otazkaTextLower.includes("rozposlan");

            if (jeUcast) {
              if (isCelkom) {
                if (
                  otazkaTextLower.includes("rozposlan") ||
                  otazkaTextLower.includes("osloven")
                ) {
                  totalS = val;
                } else if (
                  otazkaTextLower.includes("navrat") ||
                  otazkaTextLower.includes("návrat")
                ) {
                  sucRate = `${val}%`;
                } else {
                  totalR = val;
                }
              } else {
                if (
                  otazkaTextLower.includes("struktura") ||
                  otazkaTextLower.includes("štruktúra") ||
                  otazkaTextLower.includes("vyplnen") ||
                  otazkaTextLower.includes("zapojen")
                ) {
                  teamEngagementMap[team] = val;
                }
              }
              return;
            }

            // B. Extrakcia dát pre GRAFY a MATICU (iba skóre)
            if (team && otazkaText && !isCelkom && rowTyp.includes("skore")) {
              if (!quantitativeByOblast[oblast]) {
                quantitativeByOblast[oblast] = {};
              }
              if (!quantitativeByOblast[oblast][otazkaText]) {
                quantitativeByOblast[oblast][otazkaText] = {
                  questionType: qType,
                  scores: {},
                };
              }
              quantitativeByOblast[oblast][otazkaText].scores[team] = val;
            }
          }
        }
      });

      // Dáta pre AI: po tímoch a otázkach, odpovede obsahujú text + tému
      rawOpenQuestionsForAI = Object.entries(openQsMap).map(([teamName, qs]) => ({
        teamName,
        questions: Object.entries(qs).map(([questionText, answers]) => ({
          questionText,
          answers, // [{ text, tema }]
        })),
      }));

      // DYNAMICKÉ OBLASTI
      calculatedAreas = Object.entries(quantitativeByOblast).map(
        ([oblastName, questionsInOblast], index) => {
          return {
            id: `area_${index + 1}`,
            title: oblastName,
            teams: Array.from(uniqueTeams).map((teamName) => ({
              teamName,
              metrics: Object.entries(questionsInOblast).map(([qText, qData]) => ({
                category: qText,
                score: qData.scores[teamName] || 0,
                questionType: qData.questionType,
              })),
            })),
          };
        }
      );

      // Zostavenie počtov ľudí z Excelu
      calculatedEngagement = Array.from(uniqueTeams).map((t) => ({
        name: t,
        count: teamEngagementMap[t] || 0,
      }));
    } catch (e) {
      console.warn("Chyba pri lokálnom spracovaní:", e);
    }
  }

  // --- FALLBACK (Bez voľných odpovedí) ---
  if (rawOpenQuestionsForAI.length === 0) {
    return {
      mode: "ZAMESTNANECKA_SPOKOJNOST",
      reportMetadata: { date: new Date().getFullYear().toString(), scaleMax: 6 },
      satisfaction: {
        clientName: clientNameFromExcel || "Neznáma firma",
        surveyName: surveyNameFromExcel || "Report z prieskumu",
        totalSent: totalS,
        totalReceived: totalR,
        successRate: sucRate || "0%",
        teamEngagement: calculatedEngagement,
        openQuestions: [],
        areas: calculatedAreas || [],
      },
    } as FeedbackAnalysisResult;
  }

  // --- AI PRE TEXTOVÉ ODPORÚČANIA (cez backend API route Vercelu) ---
  let aiParsed: any = { openQuestions: [] };

  try {
    const res = await fetch("/api/analyze-open-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawOpenQuestionsForAI }),
    });

    if (!res.ok) {
      console.error("API route error:", res.status, res.statusText);
      aiParsed = { openQuestions: [] };
    } else {
      aiParsed = await res.json();
    }
  } catch (error) {
    console.error("API fetch error:", error);
    aiParsed = { openQuestions: [] };
  }

  // Normalizácia AI dát podľa novej štruktúry:
  // question.themeCloud + recommendation.quotes
  const normalizedOpenQuestions = normalizeOpenQuestionsPayload(aiParsed);

  // --- FINÁLNE ZLÚČENIE ---
  return {
    mode: "ZAMESTNANECKA_SPOKOJNOST",
    reportMetadata: { date: new Date().getFullYear().toString(), scaleMax: 6 },
    satisfaction: {
      clientName: clientNameFromExcel || "Neznáma firma",
      surveyName: surveyNameFromExcel || "Report z prieskumu",
      totalSent: totalS,
      totalReceived: totalR,
      successRate: sucRate || "0%",
      teamEngagement: calculatedEngagement,
      openQuestions: normalizedOpenQuestions,
      areas: calculatedAreas || [],
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
