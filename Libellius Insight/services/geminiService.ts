import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// --- 1. SCHÉMA PRE AI ---
const getSchema = (mode: AnalysisMode) => {
  const schemaType = Type;
  if (mode === '360_FEEDBACK') {
    return {
      type: schemaType.OBJECT,
      properties: {
        mode: { type: schemaType.STRING },
        reportMetadata: {
          type: schemaType.OBJECT,
          properties: { date: { type: schemaType.STRING }, scaleMax: { type: schemaType.NUMBER } },
          required: ["date", "scaleMax"]
        },
        employees: {
          type: schemaType.ARRAY,
          items: {
            type: schemaType.OBJECT,
            properties: {
              id: { type: schemaType.STRING },
              name: { type: schemaType.STRING },
              competencies: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { name: { type: schemaType.STRING }, selfScore: { type: schemaType.NUMBER }, othersScore: { type: schemaType.NUMBER } } } },
              recommendations: { type: schemaType.STRING }
            },
            required: ["id", "name", "competencies", "recommendations"]
          }
        }
      },
      required: ["mode", "reportMetadata", "employees"]
    };
  } else {
    const cardSchema = {
      type: schemaType.OBJECT,
      properties: {
        title: { type: schemaType.STRING },
        teams: {
          type: schemaType.ARRAY,
          items: {
            type: schemaType.OBJECT,
            properties: {
              teamName: { type: schemaType.STRING },
              metrics: {
                type: schemaType.ARRAY,
                items: {
                  type: schemaType.OBJECT,
                  properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } },
                  required: ["category", "score"]
                }
              }
            },
            required: ["teamName", "metrics"]
          }
        }
      },
      required: ["title", "teams"]
    };

    return {
      type: schemaType.OBJECT,
      properties: {
        mode: { type: schemaType.STRING },
        reportMetadata: {
          type: schemaType.OBJECT,
          properties: { date: { type: schemaType.STRING }, scaleMax: { type: schemaType.NUMBER } },
          required: ["date", "scaleMax"]
        },
        satisfaction: {
          type: schemaType.OBJECT,
          properties: {
            clientName: { type: schemaType.STRING },
            totalSent: { type: schemaType.NUMBER },
            totalReceived: { type: schemaType.NUMBER },
            successRate: { type: schemaType.STRING },
            teamEngagement: {
              type: schemaType.ARRAY,
              items: {
                type: schemaType.OBJECT,
                properties: { name: { type: schemaType.STRING }, count: { type: schemaType.NUMBER } },
                required: ["name", "count"]
              }
            },
            card1: cardSchema,
            card2: cardSchema,
            card3: cardSchema,
            card4: cardSchema
          },
          required: ["clientName", "totalSent", "totalReceived", "successRate", "teamEngagement", "card1", "card2", "card3", "card4"]
        }
      },
      required: ["mode", "reportMetadata", "satisfaction"]
    };
  }
};

// --- 2. PARSOVANIE EXCELU ---
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
          skupina: row['skupina'] || row['Skupina'],
          otazka: row['otazka'] || row['Otazka'],
          hodnota: row['hodnota'],
          text: row['text_odpovede'], 
          oblast: row['oblast'] || row['typ']
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

// --- 3. HLAVNÁ ANALÝZA S HYBRIDNÝM PRÍSTUPOM ---
export const analyzeDocument = async (
  inputData: string, 
  mode: AnalysisMode,
  isExcel: boolean = false
): Promise<FeedbackAnalysisResult> => {

  let extractedOpenQuestions: any[] = [];
  let aiInputData = inputData;
  let teamsListString = "";

  if (isExcel && mode === 'ZAMESTNANECKA_SPOKOJNOST') {
    try {
      const rawData = JSON.parse(inputData);
      const openQsMap: Record<string, Record<string, string[]>> = {};
      const filteredForAi: any[] = [];
      const uniqueTeams = new Set<string>();

      rawData.forEach((row: any) => {
        if (row.skupina && row.skupina !== 'Celkom') {
           uniqueTeams.add(row.skupina);
        }

        if (row.text && row.text.toString().trim() !== "") {
          const team = row.skupina;
          const q = row.otazka;
          const ans = row.text.toString();
          
          if (team && q) {
            if (!openQsMap[team]) openQsMap[team] = {};
            if (!openQsMap[team][q]) openQsMap[team][q] = [];
            openQsMap[team][q].push(ans);
          }
        } 
        else if (row.hodnota !== undefined && row.hodnota !== null && row.hodnota !== "") {
          filteredForAi.push(row);
        }
      });

      teamsListString = Array.from(uniqueTeams).join(", ");

      extractedOpenQuestions = Object.entries(openQsMap).map(([teamName, qs]) => ({
        teamName,
        questions: Object.entries(qs).map(([questionText, answers]) => ({
          questionText,
          answers
        }))
      }));

      aiInputData = JSON.stringify(filteredForAi);
    } catch (e) {
      console.warn("Chyba pri manuálnej extrakcii textov", e);
    }
  }

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const promptSatisfaction = `
    Si HR analytik. Spracuj priložené dáta (JSON format) z prieskumu spokojnosti.
    Dáta obsahujú číselné metriky (tvrdenia a ich hodnotenie).

    DÔLEŽITÉ - ZOZNAM TÍMOV V DÁTACH:
    ${teamsListString}
    
    1. METRIKY (KARTY 1-4):
       - Dáta sú rozdelené do oblastí (kľúč 'oblast'). Prvú oblasť daj do card1, druhú do card2 atď. (do 'title' daj názov oblasti).
       - V rámci každej karty vytvor záznam pre KAŽDÝ JEDEN TÍM z vyššie uvedeného zoznamu.
       - ZÁSADNÉ PRAVIDLO: Pre daný tím NEPOČÍTAJ jeden celkový priemer! V grafe chceme vidieť všetky tvrdenia samostatne.
       - Do poľa 'metrics' vlož VŠETKY tvrdenia (z kľúča 'otazka'), ktoré do danej oblasti patria.
       - 'category' = text tvrdenia. Vzhľadom na to, že tvrdenia sú dlhé vety, inteligentne a trefne ich SKRÁŤ na 4 až 6 slov, aby sa zmestili na os grafu (napr. "Viem, čo sa odo mňa očakáva" zmeň na "Jasné pracovné očakávania").
       - 'score' = presná 'hodnota' priradená k tomuto tvrdeniu a tomuto tímu v dátach.
       - Zopakuj to pre všetky tímy, nesmieš ani jeden vynechať.

    2. ÚČASŤ (teamEngagement):
       - Vytvor záznam v poli teamEngagement pre každý jeden tím z vyššie uvedeného zoznamu.
       - 'totalSent', 'totalReceived' a 'successRate' vytiahni zo skupiny 'Celkom'.
  `;

  try {
    const basePrompt = mode === '360_FEEDBACK' ? "Analyzuj 360-stupňovú spätnú väzbu." : promptSatisfaction;
    
    const parts = [{ text: isExcel ? `${basePrompt}\n\nDÁTA NA ANALÝZU:\n${aiInputData}` : basePrompt }];

    if (!isExcel && aiInputData) {
      parts.push({ inlineData: { data: aiInputData, mimeType: "application/pdf" } } as any);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { role: "user", parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
        temperature: 0.1
      }
    });

    const text = response.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const finalResult = JSON.parse(cleanJson) as FeedbackAnalysisResult;

    if (mode === 'ZAMESTNANECKA_SPOKOJNOST' && finalResult.satisfaction) {
      finalResult.satisfaction.openQuestions = extractedOpenQuestions;
    }

    return finalResult;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "Chyba pri analýze dokumentu.");
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
