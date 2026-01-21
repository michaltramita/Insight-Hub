import { GoogleGenAI, Type } from "@google/genai";
import { FeedbackAnalysisResult, AnalysisMode, GenericAnalysisResult, RawCell, MissingCellRecord, TeamMetadata, SatisfactionData, TeamWorkSituation } from "../types";

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
    // New cell-first (generic) schema for satisfaction mode
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
        metadata: {
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
            }
          },
          required: ["clientName", "totalSent", "totalReceived", "successRate", "teamEngagement"]
        },
        teams: {
          type: schemaType.ARRAY,
          items: {
            type: schemaType.OBJECT,
            properties: {
              id: { type: schemaType.STRING },
              name: { type: schemaType.STRING }
            },
            required: ["id", "name"]
          }
        },
        cells: {
          type: schemaType.ARRAY,
          items: {
            type: schemaType.OBJECT,
            properties: {
              sectionName: { type: schemaType.STRING },
              teamName: { type: schemaType.STRING },
              questionText: { type: schemaType.STRING },
              score: { type: schemaType.NUMBER, nullable: true }
            },
            required: ["sectionName", "teamName", "questionText", "score"]
          }
        },
        missingCells: {
          type: schemaType.ARRAY,
          items: {
            type: schemaType.OBJECT,
            properties: {
              sectionName: { type: schemaType.STRING },
              teamName: { type: schemaType.STRING },
              questionText: { type: schemaType.STRING },
              reason: { type: schemaType.STRING }
            },
            required: ["sectionName", "teamName", "questionText", "reason"]
          }
        }
      },
      required: ["mode", "reportMetadata", "metadata", "teams", "cells", "missingCells"]
    };
  }
};

// Transform flat cells array to nested TeamWorkSituation format
const transformCellsToNestedFormat = (
  cells: RawCell[],
  teams: TeamMetadata[]
): {
  workSituationByTeam: TeamWorkSituation[];
  supervisorByTeam: TeamWorkSituation[];
  workTeamByTeam: TeamWorkSituation[];
  companySituationByTeam: TeamWorkSituation[];
} => {
  const sectionMapping: Record<string, keyof ReturnType<typeof transformCellsToNestedFormat>> = {
    'Pracovná situácia': 'workSituationByTeam',
    'Priamy nadriadený': 'supervisorByTeam',
    'Pracovný tím': 'workTeamByTeam',
    'Situácia vo firme': 'companySituationByTeam'
  };

  const result: ReturnType<typeof transformCellsToNestedFormat> = {
    workSituationByTeam: [],
    supervisorByTeam: [],
    workTeamByTeam: [],
    companySituationByTeam: []
  };

  // Initialize teams for each section
  for (const team of teams) {
    for (const sectionKey of Object.values(sectionMapping)) {
      result[sectionKey].push({
        teamName: team.name,
        metrics: []
      });
    }
  }

  // Group cells by section and team
  for (const cell of cells) {
    if (cell.score === null) continue;
    
    const sectionKey = sectionMapping[cell.sectionName];
    if (!sectionKey) continue;

    const teamData = result[sectionKey].find(t => t.teamName === cell.teamName);
    if (teamData) {
      teamData.metrics.push({
        category: cell.questionText,
        score: cell.score
      });
    }
  }

  // Remove teams with no metrics
  for (const sectionKey of Object.values(sectionMapping)) {
    result[sectionKey] = result[sectionKey].filter(t => t.metrics.length > 0);
  }

  return result;
};

export const analyzeDocument = async (base64Pdf: string, mode: AnalysisMode): Promise<FeedbackAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
  
  const prompt360 = `Analyzuj 360-stupňovú spätnú väzbu z PDF. Výstup musí byť VALIDNÝ JSON v slovenčine podľa schémy.`;

  const promptUniversal = `
    PRÍSNA INŠTRUKCIA PRE ANALÝZU TABULIEK - DVOJFÁZOVÝ PRÍSTUP:
    
    === FÁZA 1: IDENTIFIKÁCIA TÍMOV ===
    NAJPRV identifikuj VŠETKY unikátne názvy tímov z hlavičiek tabuliek na stranách 3-6.
    - Prechádzaj každú tabuľku a zaznamenaj názvy zo stĺpcových hlavičiek
    - Príklady: "Bratislava Centrála", "Vedúci pracovníci", "Obchod Západ", "Trnava Centrála", atď.
    - Nepreskoč ani jeden stĺpec!
    - Každý unikátny tím zapíš do poľa "teams" s unikátnym "id" a "name"

    === FÁZA 2: EXTRAKCIA BUNIEK ===
    PRE KAŽDÝ riadok (otázku) v tabuľke:
    1. Prečítaj text otázky z prvého stĺpca
    2. Pre každý tím (stĺpec) extrahuj číselné skóre
    3. Mapuj hodnoty na tímy podľa ich pozície (index stĺpca)
    4. Vytvor záznam do poľa "cells" s: sectionName, teamName, questionText, score

    === MAPOVANIE SEKCIÍ ===
    - Strana 3 "Pracovná situácia" -> sectionName = "Pracovná situácia"
    - Strana 4 "Priamy nadriadený" -> sectionName = "Priamy nadriadený"  
    - Strana 5 "Pracovný tím" -> sectionName = "Pracovný tím"
    - Strana 6 "Situácia vo firme" -> sectionName = "Situácia vo firme"

    === PRÍSNE PRAVIDLO PRE CHÝBAJÚCE HODNOTY ===
    NIKDY nepoužívaj 0 pre chýbajúce dáta!
    Ak hodnota nie je nájdená alebo je nečitateľná:
    - NEVKLADAJ ju do poľa "cells"
    - NAMIESTO TOHO pridaj záznam do "missingCells" s polami: sectionName, teamName, questionText, reason
    - V "reason" vysvetli prečo hodnota chýba (napr. "bunka prázdna", "nečitateľné", "stĺpec neexistuje")

    === METADATA ===
    Extrahuj tiež:
    - clientName: názov klienta/organizácie
    - totalSent: počet odoslaných dotazníkov
    - totalReceived: počet prijatých odpovedí
    - successRate: percentuálna úspešnosť
    - teamEngagement: zapojenie jednotlivých tímov (name, count, sentCount)

    Jazyk: Slovenčina. Výstup: Čistý VALIDNÝ JSON podľa schémy.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-05-2025",
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
    
    const parsed = JSON.parse(cleanJson);

    // Transform generic result to legacy format for satisfaction mode
    if (mode === 'ZAMESTNANECKA_SPOKOJNOST') {
      const genericResult = parsed as GenericAnalysisResult;
      const nestedData = transformCellsToNestedFormat(genericResult.cells, genericResult.teams);
      
      const satisfactionData: SatisfactionData = {
        clientName: genericResult.metadata.clientName,
        totalSent: genericResult.metadata.totalSent,
        totalReceived: genericResult.metadata.totalReceived,
        successRate: genericResult.metadata.successRate,
        teamEngagement: genericResult.metadata.teamEngagement,
        ...nestedData
      };

      return {
        mode: genericResult.mode,
        reportMetadata: genericResult.reportMetadata,
        satisfaction: satisfactionData,
        genericData: {
          metadata: genericResult.metadata,
          teams: genericResult.teams,
          cells: genericResult.cells,
          missingCells: genericResult.missingCells
        }
      } as FeedbackAnalysisResult;
    }

    return parsed as FeedbackAnalysisResult;
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
