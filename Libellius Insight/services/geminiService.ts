import { GoogleGenAI, Type } from "@google/genai";
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
              gaps: {
                type: schemaType.ARRAY,
                items: {
                  type: schemaType.OBJECT,
                  properties: {
                    statement: { type: schemaType.STRING },
                    selfScore: { type: schemaType.NUMBER },
                    othersScore: { type: schemaType.NUMBER },
                    diff: { type: schemaType.NUMBER }
                  }
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
          required: ["clientName", "totalSent", "totalReceived", "successRate", "teamEngagement", "workSituationByTeam", "supervisorByTeam", "workTeamByTeam", "companySituationByTeam"]
        }
      },
      required: ["mode", "reportMetadata", "satisfaction"]
    };
  }
};

export const analyzeDocument = async (base64Pdf: string, mode: AnalysisMode): Promise<FeedbackAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
  
  const prompt360 = `Analyzuj 360-stupňovú spätnú väzbu z PDF. Výstup musí byť VALIDNÝ JSON v slovenčine podľa schémy.`;

  const promptUniversal = `
    DÔLEŽITÉ: Analyzuj tabuľky prieskumu spokojnosti na stranách 4-13.
    Štruktúra PDF: Riadky sú otázky/kategórie. STĹPCE sú jednotlivé tímy.
    
    POKYNY:
    1. Identifikuj všetky tímy v hlavičkách stĺpcom (napr. "Bratislava Centrála", "Vedúci pracovníci", "Obchod Západ", "Trnava Centrála" atď.).
    2. Pre každý tím priraď presné číselné hodnoty z riadkov tabuliek:
       - Tabuľky "Pracovná situácia" -> mapuj do 'workSituationByTeam'
       - Tabuľky "Priamy nadriadený" -> mapuj do 'supervisorByTeam'
       - Tabuľky "Pracovný tím" -> mapuj do 'workTeamByTeam'
       - Tabuľky "Situácia vo firme" -> mapuj do 'companySituationByTeam'
    
    Dbaj na presné priradenie hodnoty zo stĺpca k tímu. 
    Jazyk: Slovenčina. Formát: Čistý JSON podľa schémy.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-preview-09-2025",
      contents: {
        role: "user",
        parts: [
          { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
          { text: mode === '360_FEEDBACK' ? prompt360 : promptUniversal }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
        temperature: 0.1
      }
    });

    const text = response.text || "";
    if (!text) throw new Error("Model nevrátil žiadne dáta.");
    
    // Odstránenie markdown obalu a prázdnych znakov
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(cleanJson) as FeedbackAnalysisResult;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "Chyba pri spracovaní dokumentu.");
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
