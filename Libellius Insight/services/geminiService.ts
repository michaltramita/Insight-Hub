import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// --- 1. SCHÉMA ---
const getSchema = (mode: AnalysisMode) => {
  const schemaType = Type;
  if (mode === '360_FEEDBACK') {
    return {
      type: schemaType.OBJECT,
      properties: {
        mode: { type: schemaType.STRING },
        reportMetadata: {
          type: schemaType.OBJECT,
          properties: {
            date: { type: schemaType.STRING },
            scaleMax: { type: schemaType.NUMBER }
          },
          required: ["date", "scaleMax"]
        },
        employees: {
          type: schemaType.ARRAY,
          items: {
            type: schemaType.OBJECT,
            properties: {
              id: { type: schemaType.STRING },
              name: { type: schemaType.STRING },
              competencies: {
                type: schemaType.ARRAY,
                items: {
                  type: schemaType.OBJECT,
                  properties: {
                    name: { type: schemaType.STRING },
                    selfScore: { type: schemaType.NUMBER },
                    othersScore: { type: schemaType.NUMBER }
                  },
                  required: ["name", "selfScore", "othersScore"]
                }
              },
              recommendations: { type: schemaType.STRING }
            },
            required: ["id", "name", "competencies", "recommendations"]
          }
        }
      },
      required: ["mode", "reportMetadata", "employees"]
    };
  } else {
    // UNIVERZÁLNA DYNAMICKÁ SCHÉMA PRE SPOKOJNOSŤ
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
                properties: { 
                  name: { type: schemaType.STRING }, 
                  count: { type: schemaType.NUMBER }, 
                  sentCount: { type: schemaType.NUMBER } 
                },
                required: ["name", "count", "sentCount"]
              }
            },
            // Dynamické kategórie podľa hárkov v Exceli
            categories: {
              type: schemaType.ARRAY,
              items: {
                type: schemaType.OBJECT,
                properties: {
                  categoryName: { type: schemaType.STRING },
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
                            properties: { 
                              category: { type: schemaType.STRING }, 
                              score: { type: schemaType.NUMBER } 
                            },
                            required: ["category", "score"]
                          }
                        }
                      },
                      required: ["teamName", "metrics"]
                    }
                  }
                },
                required: ["categoryName", "teams"]
              }
            }
          },
          required: ["clientName", "totalSent", "totalReceived", "successRate", "teamEngagement", "categories"]
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
        let combinedData = "";

        // Prechádzame všetky hárky
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(worksheet);
          combinedData += `\n--- SEKCOA: ${sheetName} ---\n${csvData}\n`;
        });

        // Oprava čiarky na bodku (dôležité pre desatinné čísla)
        const normalizedText = combinedData.replace(/(\d+),(\d+)/g, '$1.$2');
        resolve(normalizedText);
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

  const promptSatisfaction = `Si HR analytik. Analyzuj dáta z prieskumu spokojnosti. Každú sekciu (hárok) spracuj ako objekt v poli 'categories'. Pre každý tím extrahuj priemerné skóre.`;

  try {
    const basePrompt = mode === '360_FEEDBACK' ? "Analyzuj 360 feedback." : promptSatisfaction;
    const parts = [];

    if (isExcel) {
      parts.push({ text: `${basePrompt}\n\nDÁTA NA ANALÝZU:\n${inputData}` });
    } else {
      parts.push({ inlineData: { data: inputData, mimeType: "application/pdf" } });
      parts.push({ text: basePrompt });
    }

    // Nastavený správny model: gemini-2.5-pro
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro", 
      contents: {
        role: "user",
        parts: parts
      },
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
