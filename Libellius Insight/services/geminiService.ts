import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

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
                properties: {
                  name: { type: SchemaType.STRING },
                  count: { type: SchemaType.NUMBER },
                  sentCount: { type: SchemaType.NUMBER }
                },
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
                      properties: {
                        category: { type: SchemaType.STRING },
                        score: { type: SchemaType.NUMBER }
                      },
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
                      properties: {
                        category: { type: SchemaType.STRING },
                        score: { type: SchemaType.NUMBER }
                      },
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
                      properties: {
                        category: { type: SchemaType.STRING },
                        score: { type: SchemaType.NUMBER }
                      },
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
                      properties: {
                        category: { type: SchemaType.STRING },
                        score: { type: SchemaType.NUMBER }
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
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  
  // Ponechaný váš pôvodný model
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite-preview-09-2025" 
  });
  
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

    Language: Slovak. Mode: 'ZAMESTNANECKA_SPOKOJNOST'.
  `;

  try {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
          { text: mode === '360_FEEDBACK' ? prompt360 : promptUniversal }
        ]
      }],
      generationConfig: {
        // Tu sme odstránili tools: [{ codeExecution: {} }], ktorý spôsoboval chybu
        responseMimeType: "application/json",
        responseSchema: getSchema(mode) as any,
      }
    });

    const response = await result.response;
    const text = response.text();
    
    if (!text) throw new Error("Model nevrátil žiadne dáta.");
    
    const parsed = JSON.parse(text.trim()) as FeedbackAnalysisResult;
    return parsed;
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
