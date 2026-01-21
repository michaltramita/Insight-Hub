import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// --- 1. SCHÉMA (Nezmenená, upravené len importy pre stabilitu) ---
const getSchema = (mode: AnalysisMode) => {
  if (mode === '360_FEEDBACK') {
    return {
      type: SchemaType.OBJECT,
      properties: {
        mode: { type: SchemaType.STRING },
        reportMetadata: {
          type: SchemaType.OBJECT,
          properties: {
            date: { type: SchemaType.STRING },
            scaleMax: { type: SchemaType.NUMBER }
          },
          required: ["date", "scaleMax"]
        },
        employees: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              name: { type: SchemaType.STRING },
              competencies: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    name: { type: SchemaType.STRING },
                    selfScore: { type: SchemaType.NUMBER },
                    othersScore: { type: SchemaType.NUMBER }
                  },
                  required: ["name", "selfScore", "othersScore"]
                }
              },
              topStrengths: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: { text: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER } }
                }
              },
              topWeaknesses: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: { text: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER } }
                }
              },
              gaps: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    statement: { type: SchemaType.STRING },
                    selfScore: { type: SchemaType.NUMBER },
                    othersScore: { type: SchemaType.NUMBER },
                    diff: { type: SchemaType.NUMBER }
                  }
                }
              },
              recommendations: { type: SchemaType.STRING }
            },
            required: ["id", "name", "competencies", "recommendations"]
          }
        }
      },
      required: ["mode", "reportMetadata", "employees"]
    };
  } else {
    return {
      type: SchemaType.OBJECT,
      properties: {
        mode: { type: SchemaType.STRING },
        reportMetadata: {
          type: SchemaType.OBJECT,
          properties: { date: { type: SchemaType.STRING }, scaleMax: { type: SchemaType.NUMBER } },
          required: ["date", "scaleMax"]
        },
        satisfaction: {
          type: SchemaType.OBJECT,
          properties: {
            clientName: { type: SchemaType.STRING },
            totalSent: { type: SchemaType.NUMBER },
            totalReceived: { type: SchemaType.NUMBER },
            successRate: { type: SchemaType.STRING },
            teamEngagement: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: { name: { type: SchemaType.STRING }, count: { type: SchemaType.NUMBER }, sentCount: { type: SchemaType.NUMBER } },
                required: ["name", "count", "sentCount"]
              }
            },
            workSituationByTeam: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  teamName: { type: SchemaType.STRING },
                  metrics: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: { category: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER } },
                      required: ["category", "score"]
                    }
                  }
                },
                required: ["teamName", "metrics"]
              }
            },
            supervisorByTeam: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  teamName: { type: SchemaType.STRING },
                  metrics: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: { category: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER } },
                      required: ["category", "score"]
                    }
                  }
                },
                required: ["teamName", "metrics"]
              }
            },
            workTeamByTeam: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  teamName: { type: SchemaType.STRING },
                  metrics: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: { category: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER } },
                      required: ["category", "score"]
                    }
                  }
                },
                required: ["teamName", "metrics"]
              }
            },
            companySituationByTeam: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  teamName: { type: SchemaType.STRING },
                  metrics: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: { category: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER } },
                      required: ["category", "score"]
                    }
                  }
                },
                required: ["teamName", "metrics"]
              }
            }
          },
          required: ["clientName", "totalSent", "totalReceived", "successRate", "teamEngagement", "workSituationByTeam", "supervisorByTeam", "workTeamByTeam", "companySituationByTeam"]
        }
      },
      required: ["mode", "reportMetadata", "satisfaction"]
    };
  }
};

// --- 2. PARSOVANIE EXCELU NA CSV ---
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
  
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  
  // Opravený model (2.5 neexistuje, 1.5-pro je najlepší na analýzu tabuliek)
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-pro",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: getSchema(mode),
      temperature: 0.1,
    }
  });

  const prompt360 = `Analyzuj priložené dáta z 360-stupňovej spätnej väzby. 
    1. Identifikuj zamestnancov a ich kompetencie.
    2. Vypočítaj priemery pre Seba a Okolie.
    3. Identifikuj najsilnejšie a najslabšie stránky.
    4. Výstup musí byť VALIDNÝ JSON v slovenčine.`;

  const promptSatisfaction = `Analyzuj dáta z prieskumu spokojnosti. 
    1. Identifikuj tímy a priraď odpovede ku kategóriám: "Pracovná situácia", "Priamy nadriadený", "Pracovný tím", "Situácia vo firme".
    2. Spracuj číselné skóre presne.
    3. Výstup musí byť VALIDNÝ JSON v slovenčine.`;

  try {
    let result;
    const basePrompt = mode === '360_FEEDBACK' ? prompt360 : promptSatisfaction;

    if (isExcel) {
      // PRE EXCEL: Spojíme prompt a CSV dáta do jedného textu
      result = await model.generateContent(`${basePrompt}\n\nDÁTA (CSV):\n${inputData}`);
    } else {
      // PRE PDF: Pošleme PDF súbor a prompt oddelene
      result = await model.generateContent([
        {
          inlineData: {
            data: inputData,
            mimeType: "application/pdf",
          },
        },
        basePrompt,
      ]);
    }

    const response = await result.response;
    const text = response.text();
    return JSON.parse(text) as FeedbackAnalysisResult;

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
