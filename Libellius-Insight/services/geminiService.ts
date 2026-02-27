import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// Bezpečná normalizácia textu
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const normalizeOpenQuestionsPayload = (payload: any) => {
  const safe = Array.isArray(payload?.openQuestions) ? payload.openQuestions : [];

  return safe.map((team: any) => ({
    teamName: String(team?.teamName || "").trim(),
    questions: Array.isArray(team?.questions)
      ? team.questions.map((q: any) => ({
          questionText: String(q?.questionText || "").trim(),
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
          nazov_firmy: String(
            row["nazov_firmy"] || row["Nazov_firmy"] || row["firma"] || row["Firma"] || ""
          ).trim(),
          nazov_prieskumu: String(
            row["nazov_prieskumu"] || row["Nazov_prieskumu"] || row["prieskum"] || row["Prieskum"] || ""
          ).trim(),
          tema_odpovede: String(
            row["tema_odpovede"] || row["Tema_odpovede"] || row["label_temy"] || row["Label_temy"] || ""
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

  let clientNameFromExcel = "";
  let surveyNameFromExcel = "";

  if (isExcel && mode === "ZAMESTNANECKA_SPOKOJNOST") {
    try {
      const rawData = JSON.parse(inputData);

      const firstRowWithMeta = rawData.find((r: any) => r.nazov_firmy || r.nazov_prieskumu) || {};
      clientNameFromExcel = String(firstRowWithMeta.nazov_firmy || "").trim();
      surveyNameFromExcel = String(firstRowWithMeta.nazov_prieskumu || "").trim();

      const openQsMap: Record<string, Record<string, Array<{ text: string; tema: string }>>> = {};
      const quantitativeByOblast: Record<string, Record<string, { questionType: string; scores: Record<string, number> }>> = {};
      const uniqueTeams = new Set<string>();
      
      // NOVÉ: Uchovávame si presne hodnoty zapojenia + text z Excelu
      const teamEngagementMap: Record<string, { received: number; sent: number; interpretation: string }> = {};

      rawData.forEach((row: any) => {
        const team = String(row.skupina || "").trim();
        const isCelkom = normalize(team) === "celkom";

        if (team && !isCelkom) uniqueTeams.add(team);

        const rowTyp = normalize(String(row.typ || ""));
        const otazkaText = String(row.otazka || "").trim();
        const otazkaTextLower = normalize(otazkaText);
        const oblast = String(row.oblast || "Iné oblasti").trim();
        const oblastNorm = normalize(oblast);
        
        // --- 1. ODCHYTENIE MANUÁLNEJ INTERPRETÁCIE ---
        if (otazkaTextLower.includes("interpretacia zapojenia") || otazkaTextLower.includes("interpretácia zapojenia")) {
            if (!teamEngagementMap[team]) teamEngagementMap[team] = { received: 0, sent: 0, interpretation: "" };
            // Text odpovede si uložíme do premennej interpretation
            teamEngagementMap[team].interpretation = String(row.text || "").trim();
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
          }
          return;
        }

        // 3. Kvantitatívne údaje a zapojenie
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
                
                if (otazkaTextLower.includes("osloven") || otazkaTextLower.includes("rozposlan")) {
                  teamEngagementMap[team].sent = val;
                } else if (otazkaTextLower.includes("struktura") || otazkaTextLower.includes("vyplnen") || otazkaTextLower.includes("zapojen")) {
                  teamEngagementMap[team].received = val; 
                }
              }
              return;
            }

            if (team && otazkaText && !isCelkom && rowTyp.includes("skore")) {
              if (!quantitativeByOblast[oblast]) quantitativeByOblast[oblast] = {};
              if (!quantitativeByOblast[oblast][otazkaText]) {
                quantitativeByOblast[oblast][otazkaText] = { questionType: qType, scores: {} };
              }
              quantitativeByOblast[oblast][otazkaText].scores[team] = val;
            }
          }
        }
      });

      rawOpenQuestionsForAI = Object.entries(openQsMap).map(([teamName, qs]) => ({
        teamName,
        questions: Object.entries(qs).map(([questionText, answers]) => ({ questionText, answers })),
      }));

      calculatedAreas = Object.entries(quantitativeByOblast).map(([oblastName, questionsInOblast], index) => {
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
      });

      // --- Zostavenie objektu z Excelu (aj s manuálnym textom `aiSummary`) ---
      calculatedEngagement = Array.from(uniqueTeams).map((t) => ({
        name: t,
        count: teamEngagementMap[t]?.received || 0,
        totalSent: teamEngagementMap[t]?.sent || 0,
        aiSummary: teamEngagementMap[t]?.interpretation || "", // Priradené priamo z Excelu!
      }));
    } catch (e) {
      console.warn("Chyba pri lokálnom spracovaní:", e);
    }
  }

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

  // Odosielame na API iba otvorené otázky
  let aiParsed: any = { openQuestions: [] };

  try {
    const res = await fetch("/api/analyze-open-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // API už nevyžaduje engagementData, posielame len toto
      body: JSON.stringify({ rawOpenQuestionsForAI }), 
    });

    if (!res.ok) {
      console.error("API route error:", res.status, res.statusText);
    } else {
      aiParsed = await res.json();
    }
  } catch (error) {
    console.error("API fetch error:", error);
  }

  const normalizedOpenQuestions = normalizeOpenQuestionsPayload(aiParsed);

  return {
    mode: "ZAMESTNANECKA_SPOKOJNOST",
    reportMetadata: { date: new Date().getFullYear().toString(), scaleMax: 6 },
    satisfaction: {
      clientName: clientNameFromExcel || "Neznáma firma",
      surveyName: surveyNameFromExcel || "Report z prieskumu",
      totalSent: totalS,
      totalReceived: totalR,
      successRate: sucRate || "0%",
      teamEngagement: calculatedEngagement, // Vraciame presne to, čo sme prečítali z Excelu
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
