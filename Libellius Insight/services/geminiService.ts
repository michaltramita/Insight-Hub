import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

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
            card1: cardSchema, card2: cardSchema, card3: cardSchema, card4: cardSchema
          },
          required: ["clientName", "totalSent", "totalReceived", "successRate", "teamEngagement", "card1", "card2", "card3", "card4"]
        }
      },
      required: ["mode", "reportMetadata", "satisfaction"]
    };
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

export const parseExcelFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        resolve(XLSX.utils.sheet_to_csv(worksheet));
      } catch (err) {
        reject(new Error("Nepodarilo sa spracovať Excel."));
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

export const analyzeDocument = async (inputData: string, mode: AnalysisMode, isExcel: boolean = false): Promise<FeedbackAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  const promptSatisfaction = `
    Si HR analytik. Spracuj priložené dáta.
    1. Rozdeľ oblasti (stĺpec oblast) do card1 až card4.
    2. DÔLEŽITÉ: Skupinu 'Priemer' alebo 'Celkový priemer' VŽDY zahrň ako regulárny tím do každej karty.
    3. Extrahuj počty odpovedí pre všetky tímy vrátane 'Priemer'.
    4. Použi Celkom pre štatistiky návratnosti.
  `;

  try {
    const basePrompt = mode === '360_FEEDBACK' ? "Analyzuj 360 spätnú väzbu z PDF." : promptSatisfaction;
    const parts: any[] = [{ text: isExcel ? `${basePrompt}\n\nDÁTA:\n${inputData}` : basePrompt }];
    
    if (!isExcel) {
      parts.push({ inlineData: { data: inputData, mimeType: "application/pdf" } });
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: getSchema(mode) as any }
    });

    return JSON.parse(result.response.text()) as FeedbackAnalysisResult;
  } catch (error: any) {
    throw new Error("Analýza zlyhala: " + error.message);
  }
};
