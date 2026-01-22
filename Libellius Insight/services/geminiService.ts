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

export const analyzeDocument = async (inputData: string, mode: AnalysisMode, isExcel: boolean = false): Promise<FeedbackAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const promptSatisfaction = `
    Si HR analytik. Spracuj priložené CSV dáta z prieskumu spokojnosti.
    1. Identifikuj oblasti v stĺpci 'oblast' a priraď ich postupne do card1 až card4.
    2. DÔLEŽITÉ: V dátach sa nachádza skupina 'Priemer' (alebo 'Celkový priemer'). Túto skupinu NEIGNORUJ. 
       Zahrň ju do každého poľa 'teams' na každej karte ako regulárny tím, aby bolo možné porovnanie s priemerom.
    3. V 'teamEngagement' extrahuj počty z oblasti 'Zapojenie účastníkov' pre všetky tímy VRÁTANE tímu 'Priemer'.
    4. Údaje o celkovej firme (Celkom) použi pre 'totalSent', 'totalReceived' a 'successRate'.
  `;

  try {
    const basePrompt = mode === '360_FEEDBACK' ? "Analyzuj 360 spätnú väzbu." : promptSatisfaction;
    const parts = [{ text: isExcel ? `${basePrompt}\n\nDÁTA:\n${inputData}` : basePrompt }];
    if (!isExcel) parts.push({ inlineData: { data: inputData, mimeType: "application/pdf" } } as any);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { role: "user", parts: parts },
      config: { responseMimeType: "application/json", responseSchema: getSchema(mode), temperature: 0.1 }
    });

    const cleanJson = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson) as FeedbackAnalysisResult;
  } catch (error: any) {
    throw new Error(error.message || "Chyba pri analýze.");
  }
};
