import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx"; // Uisti sa, že máš nainštalované: npm install xlsx
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// --- 1. SCHÉMA (Nezmenená, aby sedela s tvojím Dashboardom) ---
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
    // Schéma pre ZAMESTNANECKA_SPOKOJNOST
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
        // Prevod na CSV string (efektívnejšie pre tokeny ako celý JSON objekt)
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

// --- 3. HLAVNÁ ANALÝZA (PDF alebo EXCEL) ---
export const analyzeDocument = async (
  inputData: string, // Base64 (pre PDF) alebo CSV String (pre Excel)
  mode: AnalysisMode,
  isExcel: boolean = false // Nový parameter na rozlíšenie vstupu
): Promise<FeedbackAnalysisResult> => {
  
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
  
  const prompt360 = `Analyzuj 360-stupňovú spätnú väzbu. Výstup musí byť VALIDNÝ JSON v slovenčine podľa schémy.`;

  // Dynamický prompt podľa toho, či ide o Excel alebo PDF
  let promptUniversal = "";
  
  if (isExcel) {
    promptUniversal = `
      INŠTRUKCIA PRE EXCEL DÁTA:
      Toto sú dáta z prieskumu spokojnosti vo formáte CSV (hodnoty oddelené čiarkou).
      
      Tvojou úlohou je:
      1. Identifikovať tímy (stĺpce v prvom riadku).
      2. Priradiť odpovede ku kategóriám (riadkom).
      3. Spracovať čísla presne tak, ako sú v CSV.
      
      Rozdeľ otázky do sekcií podľa ich významu:
      - "Pracovná situácia" -> workSituationByTeam
      - "Priamy nadriadený" -> supervisorByTeam
      - "Pracovný tím" -> workTeamByTeam
      - "Situácia vo firme" -> companySituationByTeam

      Výstup: Validný JSON podľa schémy.
      
      DÁTA:
      ${inputData}
    `;
  } else {
    // Pôvodný prompt pre PDF
    promptUniversal = `
      PRÍSNA INŠTRUKCIA PRE ANALÝZU PDF TABULIEK:
      V tomto PDF sú horizontálne tabuľky: RIADKY sú otázky a STĹPCE sú jednotlivé tímy.
      
      1. NAJPRV identifikuj VŠETKY názvy tímov v hlavičkách tabuliek.
      2. PRE KAŽDÝ tím vytvor samostatný objekt v poliach nižšie.
      3. EXTRAHUJ presné číselné skóre.
      4. MAPUJ sekcie: "Pracovná situácia", "Priamy nadriadený", "Pracovný tím", "Situácia vo firme".
      
      Ak hodnota chýba, doplň 0.
      Jazyk: Slovenčina. Výstup: Validný JSON.
    `;
  }

  try {
    const parts = [];
    
    if (isExcel) {
      // Pre Excel posielame iba text (prompt + CSV data)
      parts.push({ text: mode === '360_FEEDBACK' ? prompt360 : promptUniversal });
    } else {
      // Pre PDF posielame Base64 + prompt
      parts.push({ inlineData: { data: inputData, mimeType: "application/pdf" } });
      parts.push({ text: mode === '360_FEEDBACK' ? prompt360 : promptUniversal });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro", // Ponechaný model podľa tvojej požiadavky
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
    if (!text) throw new Error("Model nevrátil žiadne dáta.");
    
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson) as FeedbackAnalysisResult;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    // Malá poistka pre debugovanie, ak by model neexistoval
    if (error.message?.includes('404') || error.message?.includes('not found')) {
       throw new Error(`Model gemini-2.5-pro nebol nájdený. Skontroluj API kľúč alebo dostupnosť modelu.`);
    }
    throw new Error(error.message || "Chyba pri analýze dokumentu.");
  }
};

// --- 4. POMOCNÁ FUNKCIA (len pre PDF) ---
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
