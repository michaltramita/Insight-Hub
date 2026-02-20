import { GoogleGenAI, Type } from "@google/genai";
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
            // A. Extrakcia ÚČASTI (Zapojenia)
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
              return; // Už to nepúšťame do oblastí
            }

            // B. Extrakcia dát pre GRAFY a MATICU (iba Skóre)
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

      // --- DYNAMICKÉ OBLASTI ---
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

      // Zostavenie poctov ludi z Excelu
      calculatedEngagement = Array.from(uniqueTeams).map(t => {
        return { name: t, count: teamEngagementMap[t] || 0 };
      });

    } catch (e) {
      console.warn("Chyba pri lokálnom spracovaní:", e);
    }
  }

  // --- FALLBACK (Bez AI) ---
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

  // --- AI PRE TEXTOVÉ ODPORÚČANIA ---
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
  const promptText = `Si HR expert. Prečítaj si tieto voľné odpovede a pre každý tím a otázku vytvor 3 manažérske odporúčania s 3 citáciami.\nTEXTY NA ANALÝZU: ${JSON.stringify(rawOpenQuestionsForAI)}`;

  let aiParsed: any = { openQuestions: [] };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { role: "user", parts: [{ text: promptText }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            openQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: { type: Type.STRING },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        questionText: { type: Type.STRING },
                        recommendations: { 
                          type: Type.ARRAY, 
                          items: { 
                            type: Type.OBJECT,
                            properties: {
                              title: { type: Type.STRING },
                              description: { type: Type.STRING },
                              quotes: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ["title", "description", "quotes"] 
                          } 
                        }
                      },
                      required: ["questionText", "recommendations"]
                    }
                  }
                },
                required: ["teamName", "questions"]
              }
            }
          },
          required: ["openQuestions"]
        },
        temperature: 0.2
      }
    });

    const text = (response.text || "").trim();
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
      aiParsed = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('AI JSON parse failed');
      aiParsed = { openQuestions: [] };
    }

  } catch (error: any) {
    console.error("Gemini Request Error:", error);
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
