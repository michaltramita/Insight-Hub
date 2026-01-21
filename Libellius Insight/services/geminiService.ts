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
    PRÍSNA INŠTRUKCIA PRE ANALÝZU TABULIEK (strany 4-13):
    V tomto PDF sú horizontálne tabuľky: RIADKY sú otázky a STĹPCE sú jednotlivé tímy.
    
    TVOJA ÚLOHA KROK ZA KROKOM:
    1. NAJPRV identifikuj VŠETKY názvy tímov v hlavičkách tabuliek na všetkých stranách (napr. "Bratislava Centrála", "Vedúci pracovníci", "Obchod Západ", "Trnava Centrála", atď.). Nepreskoč ani jeden stĺpec!
    2. PRE KAŽDÝ JEDEN tím, ktorý si našiel, musíš vytvoriť samostatný objekt v poliach nižšie.
    3. EXTRAKCIA HODNÔT: Prejdi tabuľky vertikálne (zhora nadol) pre každý jeden stĺpec tímu a extrahuj presné číselné skóre.
    4. MAPOVANIE PODĽA SEKCIÍ:
       - Sekcia "Pracovná situácia" (strany 4-6) -> mapuj do 'workSituationByTeam'
       - Sekcia "Priamy nadriadený" (strany 7-9) -> mapuj do 'supervisorByTeam'
       - Sekcia "Pracovný tím" (strany 10-11) -> mapuj do 'workTeamByTeam'
       - Sekcia "Situácia vo firme" (strany 12-13) -> mapuj do 'companySituationByTeam'

    DÔLEŽITÉ: 
    - Musíš spracovať VŠETKY stĺpce (tímy). Ak tím nemá v niektorom riadku hodnotu, uveď 0.
    - Nikdy nesmieš zlúčiť dva tímy do jedného.
    
    Jazyk: Slovenčina. Výstup: Čistý VALIDNÝ JSON podľa schémy.
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
    
    // Odstránenie markdown obalu pre istotu
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsed = JSON.parse(cleanJson) as FeedbackAnalysisResult;
    return parsed;
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
