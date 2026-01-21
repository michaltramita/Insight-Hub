import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// --- 1. DEFINÍCIA SCHÉMY PRE AI (JSON SCHEMA) ---
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
              topStrengths: {
                type: schemaType.ARRAY,
                items: {
                  type: schemaType.OBJECT,
                  properties: { text: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } }
                }
              },
              topWeaknesses: {
                type: schemaType.ARRAY,
                items: {
                  type: schemaType.OBJECT,
                  properties: { text: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } }
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
    // Schéma pre PRIESKUM SPOKOJNOSTI
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
                properties: { name: { type: schemaType.STRING }, count: { type: schemaType.NUMBER }, sentCount: { type: schemaType.NUMBER } },
                required: ["name", "count", "sentCount"]
              }
            },
            workSituationByTeam: {
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
            },
            supervisorByTeam: {
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
            },
            workTeamByTeam: {
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
            },
            companySituationByTeam: {
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
          required: ["clientName", "totalSent", "totalReceived", "successRate", "teamEngagement", "workSituationByTeam", "supervisorByTeam", "workTeamByTeam", "companySituationByTeam"]
        }
      },
      required: ["mode", "reportMetadata", "satisfaction"]
    };
  }
};

// --- 2. PARSOVANIE EXCELU (PODPORA VIACERÝCH HÁRKOV A ČIAROK) ---
export const parseExcelFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        let combinedData = "";

        // Prejdeme všetky hárky v Exceli
        workbook.SheetNames.forEach(name => {
          const sheet = workbook.Sheets[name];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          combinedData += `\n--- DATA PRE SEKCIU: ${name} ---\n${csv}\n`;
        });

        // OPRAVA DESATINNÝCH ČIAROK: Zmení "4,56" na "4.56" pre AI
        const normalized = combinedData.replace(/(\d+),(\d+)/g, '$1.$2');
        resolve(normalized);
      } catch (err) {
        reject(new Error("Nepodarilo sa spracovať Excel súbor."));
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

// --- 3. PREVOD PDF NA BASE64 ---
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};

// --- 4. HLAVNÁ ANALÝZA POMOCOU GEMINI 2.5 PRO ---
export const analyzeDocument = async (
  inputData: string, 
  mode: AnalysisMode,
  isExcel: boolean = false
): Promise<FeedbackAnalysisResult> => {
  
  const genAI = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  
  // Špeciálna inštrukcia pre spracovanie tvojho konkrétneho Excelu
  const basePrompt = mode === '360_FEEDBACK' 
    ? "Analyzuj dáta z 360 spätnej väzby." 
    : `Si expertný analytik HR dát. Analyzuj priložené CSV dáta z prieskumu spokojnosti. 
       Dáta obsahujú viaceré sekcie (Pracovná situácia, Nadriadený, Tím, Firma). 
       Extrahuj číselné priemery pre každý tím a každú kategóriu. 
       Dôležité: Tímy sú v stĺpcoch, kategórie sú v riadkoch. Výsledok vráť ako JSON.`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
        temperature: 0.1,
      }
    });

    const parts = [];
    if (isExcel) {
      // Excel posielame ako text (CSV)
      parts.push({ text: `${basePrompt}\n\nDÁTA:\n${inputData}` });
    } else {
      // PDF posielame ako inlineData
      parts.push({ inlineData: { data: inputData, mimeType: "application/pdf" } });
      parts.push({ text: basePrompt });
    }

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const response = await result.response;
    const text = response.text();
    
    return JSON.parse(text) as FeedbackAnalysisResult;

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "Chyba pri komunikácii s AI.");
  }
};
