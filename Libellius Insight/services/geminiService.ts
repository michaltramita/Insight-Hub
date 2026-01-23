import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// --- 1. SCHÉMA ---
const getSchema = (mode: AnalysisMode) => {
  const schemaType = Type;
  if (mode === '360_FEEDBACK') {
    return {
      type: schemaType.OBJECT,
      properties: {
        mode: { type: schemaType.STRING },
        reportMetadata: {
          type: schemaType.OBJECT,
          properties: { date: { type: schemaType.STRING }, scaleMax: { type: schemaType.NUMBER } },
          required: ["date", "scaleMax"]
        },
        employees: {
          type: schemaType.ARRAY,
          items: {
            type: schemaType.OBJECT,
            properties: {
              id: { type: schemaType.STRING },
              name: { type: schemaType.STRING },
              competencies: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { name: { type: schemaType.STRING }, selfScore: { type: schemaType.NUMBER }, othersScore: { type: schemaType.NUMBER } } } },
              recommendations: { type: schemaType.STRING }
            },
            required: ["id", "name", "competencies", "recommendations"]
          }
        }
      },
      required: ["mode", "reportMetadata", "employees"]
    };
  } else {
    const cardSchema = {
      type: schemaType.OBJECT,
      properties: {
        title: { type: schemaType.STRING },
        teams: {
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
      required: ["title", "teams"]
    };

    // --- NOVÉ: Schéma pre voľné otázky ---
    const openQuestionsSchema = {
      type: schemaType.ARRAY,
      items: {
        type: schemaType.OBJECT,
        properties: {
          teamName: { type: schemaType.STRING },
          questions: {
            type: schemaType.ARRAY,
            items: {
              type: schemaType.OBJECT,
              properties: {
                questionText: { type: schemaType.STRING },
                answers: { type: schemaType.ARRAY, items: { type: schemaType.STRING } }
              }
            }
          }
        }
      }
    };

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
                properties: { name: { type: schemaType.STRING }, count: { type: schemaType.NUMBER } },
                required: ["name", "count"]
              }
            },
            // --- NOVÉ: Pridané do hlavného objektu ---
            openQuestions: openQuestionsSchema,
            
            card1: cardSchema,
            card2: cardSchema,
            card3: cardSchema,
            card4: cardSchema
          },
          required: ["clientName", "totalSent", "totalReceived", "successRate", "teamEngagement", "openQuestions", "card1", "card2", "card3", "card4"]
        }
      },
      required: ["mode", "reportMetadata", "satisfaction"]
    };
  }
};

// --- 2. PARSOVANIE EXCELU (Upravené pre texty) ---
export const parseExcelFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // ZMENA: Používame JSON namiesto CSV pre lepšiu kontrolu nad stĺpcami
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        // Mapujeme len relevantné stĺpce (aby sme šetrili tokeny a boli presní)
        const simplifiedData = jsonData.map(row => ({
          skupina: row['skupina'] || row['Skupina'],
          otazka: row['otazka'] || row['Otazka'],
          hodnota: row['hodnota'],          // Čísla pre grafy
          text: row['text_odpovede'],       // Texty pre otvorené otázky (z tvojho excelu)
          oblast: row['oblast'] || row['typ'] // Pre rozdelenie do kariet
        }));

        // Limitujeme dĺžku stringu pre istotu
        resolve(JSON.stringify(simplifiedData).slice(0, 400000));
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
  
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const promptSatisfaction = `
    Si HR analytik. Spracuj priložené dáta (JSON format) z prieskumu spokojnosti.
    
    1. METRIKY (KARTY 1-4):
       - Identifikuj unikátne hodnoty v kľúči 'oblast' (alebo 'typ').
       - Prvú nájdenú oblasť priraď do 'card1', druhú do 'card2', atď.
       - Pre každú kartu zoskup riadky podľa 'skupina' (teamName) a vypočítaj priemer z 'hodnota'. 
       - DÔLEŽITÉ: Zahrň aj riadky, kde skupina je 'Priemer' alebo 'Celkový priemer'.

    2. VOĽNÉ OTÁZKY (openQuestions):
       - Hľadaj záznamy, kde je vyplnený kľúč 'text' (text_odpovede).
       - Tieto záznamy priraď do poľa 'openQuestions'.
       - Zoskup ich podľa 'skupina' (teamName) a 'otazka'.
       - Všetky texty vlož do poľa 'answers'.

    3. ÚČASŤ:
       - V 'teamEngagement' extrahuj počty pre všetky tímy.
       - 'totalSent', 'totalReceived' a 'successRate' vytiahni zo skupiny 'Celkom'.
  `;

  try {
    const basePrompt = mode === '360_FEEDBACK' ? "Analyzuj 360-stupňovú spätnú väzbu." : promptSatisfaction;
    
    // Ak je to Excel, posielame JSON string ako text. Ak PDF, tak inlineData.
    const parts = [{ text: isExcel ? `${basePrompt}\n\nDÁTA NA ANALÝZU:\n${inputData}` : basePrompt }];

    if (!isExcel && inputData) {
      // Pre PDF a iné binary súbory
      parts.push({ inlineData: { data: inputData, mimeType: "application/pdf" } } as any);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { role: "user", parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
        temperature: 0.1
      }
    });

    const text = response.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson) as FeedbackAnalysisResult;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "Chyba pri analýze dokumentu.");
  }
};

// --- 4. EXPORTOVANÉ PRE APP.TSX ---
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
