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
    DÔLEŽITÉ: Analyzuj tabuľky prieskumu spokojnosti (hlavne strany 4-13).
    Tieto tabuľky sú horizontálne: RIADKY sú otázky, STĹPCE sú jednotlivé tímy.
    
    TVOJ POSTUP:
    1. Identifikuj všetky tímy v hlavičkách stĺpcov (napr. "Bratislava Centrála", "Vedúci pracovníci", atď.).
    2. Pre každý tím extrahuj číselné hodnoty pre kategórie v sekciách:
       - "Pracovná situácia" (str. 4-6) -> priraď do workSituationByTeam
       - "Priamy nadriadený" (str. 7-9) -> priraď do supervisorByTeam
       - "Pracovný tím" (str. 10-11) -> priraď do workTeamByTeam
       - "Situácia vo firme" (str. 12-13) -> priraď do companySituationByTeam
    
    Zabezpeč, aby si správne priradil číslo zo stĺpca k názvu tímu.
    Výstup: Čistý JSON v slovenčine podľa definovanej schémy.
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
        // Tu je odstránený codeExecution tools, ponechaný len JSON mode
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
        temperature: 0.1
      }
    });

    const text = response.text || "";
    if (!text) throw new Error("Model nevrátil žiadne dáta.");
    
    // Ošetrenie pre prípad, že by model vrátil markdown obal
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
