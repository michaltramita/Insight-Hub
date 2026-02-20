import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// Bezpečná normalizácia textu (odstráni diakritiku a zmení na malé písmená)
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const parseExcelFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        const simplifiedData = jsonData.map(row => ({
          skupina: String(row['skupina'] || row['Skupina'] || '').trim(),
          otazka: String(row['otazka'] || row['Otazka'] || '').trim(),
          hodnota: row['hodnota'] ?? row['Hodnota'] ?? '',
          text: String(row['text_odpovede'] || row['Text_odpovede'] || '').trim(),
          oblast: String(row['oblast'] || row['Oblast'] || 'Nezaradené').trim(),
          typ: String(row['typ'] || row['Typ'] || '').trim(),
          kategoria_otazky: String(row['kategoria_otazky'] || row['Kategoria_otazky'] || 'Prierezova').trim()
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

export const analyzeDocument = async (inputData: string, mode: AnalysisMode, isExcel: boolean = false): Promise<FeedbackAnalysisResult> => {
  let rawOpenQuestionsForAI: any[] = [];
  let calculatedAreas: any[] = [];
  let calculatedEngagement: any[] = [];
  let totalS = 0, totalR = 0;
  let sucRate = "";

  if (isExcel && mode === 'ZAMESTNANECKA_SPOKOJNOST') {
    try {
      const rawData = JSON.parse(inputData);
      const openQsMap: Record<string, Record<string, string[]>> = {};
      
      const quantitativeByOblast: Record<
        string,
        Record<string, { questionType: string; scores: Record<string, number> }>
      > = {};
      
      const uniqueTeams = new Set<string>();
      const teamEngagementMap: Record<string, number> = {};

      rawData.forEach((row: any) => {
        const team = String(row.skupina || '').trim();
        const isCelkom = normalize(team) === 'celkom';
        
        if (team && !isCelkom) uniqueTeams.add(team);

        const rowTyp = normalize(String(row.typ || '')); 
        const otazkaText = String(row.otazka || '').trim();
        const otazkaTextLower = normalize(otazkaText); 
        const oblast = String(row.oblast || 'Iné oblasti').trim();
        const oblastNorm = normalize(oblast);

        const rawQuestionType = String(row.kategoria_otazky || 'Prierezova').trim();
        const normQType = normalize(rawQuestionType);
        const qType = normQType.includes('specif') ? 'Specificka' : 'Prierezova';

        // 1. Voľné odpovede
        if (rowTyp.includes('volna') && row.text?.toString().trim() !== "") {
          const ans = row.text.toString().trim();
          if (team && otazkaText && !isCelkom) {
            if (!openQsMap[team]) openQsMap[team] = {};
            if (!openQsMap[team][otazkaText]) openQsMap[team][otazkaText] = [];
            openQsMap[team][otazkaText].push(ans);
          }
          return;
        } 
        
        // 2. Kvantitatívne údaje
        if (row.hodnota !== undefined && row.hodnota !== null && row.hodnota !== "") {
          const cleanHodnota = String(row.hodnota).replace(',', '.');
          const val = Number(cleanHodnota);

          if (!isNaN(val)) {
            // A. Extrakcia ÚČASTI
            const jeUcast = oblastNorm.includes('zapojenie') ||
                            otazkaTextLower.includes('zapojen') || 
                            otazkaTextLower.includes('ucast') || 
                            otazkaTextLower.includes('respondent') ||
                            otazkaTextLower.includes('odpovedal');

            if (jeUcast) {
              if (isCelkom) {
                if (otazkaTextLower.includes('rozposlan') || otazkaTextLower.includes('osloven')) {
                  totalS = val;
                } else if (otazkaTextLower.includes('navrat')) {
                  sucRate = `${val}%`;
                } else {
                  totalR = val;
                }
              } else {
                if (otazkaTextLower.includes('struktura') || otazkaTextLower.includes('vyplnen') || otazkaTextLower.includes('zapojen')) {
                  teamEngagementMap[team] = val;
                }
              }
              return; 
            }

            // B. Extrakcia dát pre GRAFY a MATICU
            if (team && otazkaText && !isCelkom && rowTyp.includes('skore')) {
              if (!quantitativeByOblast[oblast]) {
                quantitativeByOblast[oblast] = {};
              }
              if (!quantitativeByOblast[oblast][otazkaText]) {
                quantitativeByOblast[oblast][otazkaText] = {
                  questionType: qType,
                  scores: {}
                };
              }
              quantitativeByOblast[oblast][otazkaText].scores[team] = val;
            }
          }
        }
      });

      rawOpenQuestionsForAI = Object.entries(openQsMap).map(([teamName, qs]) => ({
        teamName,
        questions: Object.entries(qs).map(([questionText, answers]) => ({ questionText, answers }))
      }));

      // DYNAMICKÉ OBLASTI
      calculatedAreas = Object.entries(quantitativeByOblast).map(([oblastName, questionsInOblast], index) => {
        return {
          id: `area_${index + 1}`,
          title: oblastName,
          teams: Array.from(uniqueTeams).map(teamName => ({
            teamName,
            metrics: Object.entries(questionsInOblast).map(([qText, qData]) => ({
              category: qText,
              score: qData.scores[teamName] || 0,
              questionType: qData.questionType
            }))
          }))
        };
      });

      calculatedEngagement = Array.from(uniqueTeams).map(t => {
        return { name: t, count: teamEngagementMap[t] || 0 };
      });

    } catch (e) {
      console.warn("Chyba pri lokálnom spracovaní:", e);
    }
  }

  // --- FALLBACK (Bez voľných odpovedí) ---
  if (rawOpenQuestionsForAI.length === 0) {
    return {
      mode: 'ZAMESTNANECKA_SPOKOJNOST',
      reportMetadata: { date: new Date().getFullYear().toString(), scaleMax: 6 },
      satisfaction: {
        clientName: "Report z prieskumu",
        totalSent: totalS,
        totalReceived: totalR,
        successRate: sucRate || "0%",
        teamEngagement: calculatedEngagement,
        openQuestions: [],
        areas: calculatedAreas || []
      }
    } as FeedbackAnalysisResult;
  }

  // --- AI PRE TEXTOVÉ ODPORÚČANIA (cez backend API route Vercelu) ---
  let aiParsed: any = { openQuestions: [] };

  try {
    const res = await fetch('/api/analyze-open-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawOpenQuestionsForAI })
    });

    if (!res.ok) {
      console.error('API route error:', res.status, res.statusText);
      aiParsed = { openQuestions: [] };
    } else {
      aiParsed = await res.json();
    }
  } catch (error) {
    console.error("API fetch error:", error);
    aiParsed = { openQuestions: [] };
  }

  // --- FINÁLNE ZLÚČENIE ---
  return {
    mode: 'ZAMESTNANECKA_SPOKOJNOST',
    reportMetadata: { date: new Date().getFullYear().toString(), scaleMax: 6 },
    satisfaction: {
      clientName: "Report z prieskumu",
      totalSent: totalS,
      totalReceived: totalR,
      successRate: sucRate || "0%",
      teamEngagement: calculatedEngagement,
      openQuestions: aiParsed.openQuestions || [],
      areas: calculatedAreas || []
    }
  } as FeedbackAnalysisResult;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
