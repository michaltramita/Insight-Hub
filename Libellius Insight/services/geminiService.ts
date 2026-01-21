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
  
  const prompt360 = `
    Analyzuj tento PDF report 360-stupňovej spätnej väzby.
    Extrahuj mená zamestnancov, skóre v kompetenciách, silné stránky a oblasti na rozvoj.
    Výstup musí byť VALIDNÝ JSON v slovenčine.
  `;

  const promptUniversal = `
    Analyzuj tento PDF report prieskumu spokojnosti.
    Zameraj sa na porovnávacie tabuľky (strany 4-13), kde sú tímy v stĺpcoch.

    1. IDENTIFIKÁCIA TÍMOV:
    Nájdi všetky názvy tímov v hlavičkách tabuliek (napr. "Bratislava Centrála", "Vedúci pracovníci", "Obchod Západ" atď.).

    2. EXTRAKCIA DÁT:
    Pre každý jeden tím extrahuj číselné skóre pre všetky kategórie v sekciách:
    - "Pracovná situácia" -> mapuj na 'workSituationByTeam'
    - "Priamy nadriadený" -> mapuj na 'supervisorByTeam'
    - "Pracovný tím" -> mapuj na 'workTeamByTeam'
    - "Situácia vo firme" -> mapuj na 'companySituationByTeam'

    DÔLEŽITÉ: Prejdi tabuľku stĺpec po stĺpci, aby si správne priradil hodnoty k danému tímu.
    Jazyk: Slovenčina. Výstup musí byť kompletný JSON podľa schémy.
  `;

  try {
    const response = await ai.models.generateContent({
      // ZMENA NA PRO MODEL PRE LEPŠIU PRESNOSŤ TABULIEK
      model: "gemini-1.5-pro",
      contents: {
        role: "user",
        parts: [
          { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
          { text: mode === '360_FEEDBACK' ? prompt360 : promptUniversal }
        ]
      },
      config: {
        temperature: 0.1, // Nízka teplota pre maximálnu presnosť čísel
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
      }
    });

    const text = response.text || "";
    if (!text) throw new Error("Model nevrátil žiadne dáta.");
    
    return JSON.parse(text.trim()) as FeedbackAnalysisResult;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "Chyba pri komunikácii s AI modelom.");
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
