import { GoogleGenAI, Type } from "@google/genai";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

const getSchema = (mode: AnalysisMode) => {
  if (mode === '360_FEEDBACK') {
    return {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING },
        reportMetadata: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            scaleMax: { type: Type.NUMBER }
          },
          required: ["date", "scaleMax"]
        },
        employees: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              competencies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    selfScore: { type: Type.NUMBER },
                    othersScore: { type: Type.NUMBER }
                  },
                  required: ["name", "selfScore", "othersScore"]
                }
              },
              topStrengths: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { text: { type: Type.STRING }, score: { type: Type.NUMBER } }
                }
              },
              topWeaknesses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { text: { type: Type.STRING }, score: { type: Type.NUMBER } }
                }
              },
              gaps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    statement: { type: Type.STRING },
                    selfScore: { type: Type.NUMBER },
                    othersScore: { type: Type.NUMBER },
                    diff: { type: Type.NUMBER }
                  }
                }
              },
              recommendations: { type: Type.STRING }
            },
            required: ["id", "name", "competencies", "recommendations"]
          }
        }
      },
      required: ["mode", "reportMetadata", "employees"]
    };
  } else {
    return {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING },
        reportMetadata: {
          type: Type.OBJECT,
          properties: { date: { type: Type.STRING }, scaleMax: { type: Type.NUMBER } },
          required: ["date", "scaleMax"]
        },
        satisfaction: {
          type: Type.OBJECT,
          properties: {
            clientName: { type: Type.STRING },
            totalSent: { type: Type.NUMBER },
            totalReceived: { type: Type.NUMBER },
            successRate: { type: Type.STRING },
            teamEngagement: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  count: { type: Type.NUMBER },
                  sentCount: { type: Type.NUMBER }
                },
                required: ["name", "count", "sentCount"]
              }
            },
            workSituationByTeam: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: { type: Type.STRING },
                  metrics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        score: { type: Type.NUMBER }
                      },
                      required: ["category", "score"]
                    }
                  }
                },
                required: ["teamName", "metrics"]
              }
            },
            supervisorByTeam: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: { type: Type.STRING },
                  metrics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        score: { type: Type.NUMBER }
                      },
                      required: ["category", "score"]
                    }
                  }
                },
                required: ["teamName", "metrics"]
              }
            },
            workTeamByTeam: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: { type: Type.STRING },
                  metrics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        score: { type: Type.NUMBER }
                      },
                      required: ["category", "score"]
                    }
                  }
                },
                required: ["teamName", "metrics"]
              }
            },
            companySituationByTeam: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: { type: Type.STRING },
                  metrics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        score: { type: Type.NUMBER }
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
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || "" });
  
  const prompt360 = `
    Analyze this 360-degree feedback PDF. 
    1. Identify employee names and scores in 5 competencies.
    2. Extract strengths and "Blind Spots".
    CRITICAL: Output must be a COMPLETE and VALID JSON in Slovak.
  `;

  const promptUniversal = `
    Analyze this Employee Satisfaction Survey PDF. 
    
    1. MASTER TEAM LIST:
    Identify every team and their response counts from the participation table (usually titled "Zapojenie účastníkov").

    2. DATA EXTRACTION:
    For all matrix tables (Work Situation, Supervisor, Work Team, Company Situation):
    - Extract Literal question categories.
    - Map scores for EVERY team column identified in Step 1.
    - Use code execution to ensure columns are aligned with the correct teams.

    Language: Slovak. Mode: 'ZAMESTNANECKA_SPOKOJNOST'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-preview-09-2025",
      contents: {
        parts: [
          { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
          { text: mode === '360_FEEDBACK' ? prompt360 : promptUniversal }
        ]
      },
      config: {
        tools: [{ codeExecution: {} }],
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
      }
    });

    let text = response.text || "";
    if (!text) throw new Error("Model nevrátil žiadne dáta.");
    
    const parsed = JSON.parse(text.trim()) as FeedbackAnalysisResult;
    return parsed;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    if (error.message?.includes("AUTH_ERROR")) throw error;
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
