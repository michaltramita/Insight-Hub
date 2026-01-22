import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// --- 1. SCHÉMA ---
const getSchema = (mode: AnalysisMode) => {
  const schemaType = Type;
  if (mode === '360_FEEDBACK') {
    // ... (ponechané pôvodné pre 360 feedback)
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
    // NOVÁ ŠTRUKTÚRA PRE ZAMESTNANECKÚ SPOKOJNOSŤ (CARD 1-4)
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
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        resolve(csvData);
      } catch (err) {
        reject(new Error("Nepodarilo sa prečítať Excel súbor."));
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

// --- 3. HLAVNÁ ANALÝZA ---
export const analyzeDocument = async (
  inputData: string, 
  mode: AnalysisMode,
  isExcel: boolean = false
): Promise<FeedbackAnalysisResult> => {
  
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const promptSatisfaction = `
    Si HR analytik. Spracuj priložené CSV dáta z prieskumu spokojnosti.
    
    1. Identifikuj unikátne hodnoty v stĺpci 'oblast'.
    2. Prvú nájdenú oblasť (napr. 'Pracovná náplň') priraď do 'card1', druhú do 'card2', atď.
    3. Do poľa 'title' v každej karte napíš presný názov tejto oblasti.
    4. Pre každú kartu zoskup riadky podľa stĺpca 'skupina' (teamName).
    5. V 'teamEngagement' extrahuj riadky, kde oblast je 'Zapojenie účastníkov' a skupina obsahuje názvy tímov.
    6. 'totalSent', 'totalReceived' a 'successRate' vytiahni z riadkov v oblasti 'Zapojenie účastníkov', kde skupina je 'Celkom'.
  `;

  try {
    const basePrompt = mode === '360_FEEDBACK' ? "Analyzuj 360-stupňovú spätnú väzbu." : promptSatisfaction;
    const parts = [{ text: isExcel ? `${basePrompt}\n\nDÁTA NA ANALÝZU:\n${inputData}` : basePrompt }];

    if (!isExcel) {
      parts.push({ inlineData: { data: inputData, mimeType: "application/pdf" } } as any);
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
    return JSON.parse(cleanJson) as FeedbackAnalysisResult;

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
