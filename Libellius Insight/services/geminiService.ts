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
            required: ["id", "name"]
          }
        }
      },
      required: ["mode", "reportMetadata", "employees"]
    };
  } else {
    // Schéma pre SPOKOJNOSŤ - zostáva rovnaká
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
            workSituationByTeam: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { teamName: { type: schemaType.STRING }, metrics: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } } } } }, required: ["teamName", "metrics"] } },
            supervisorByTeam: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { teamName: { type: schemaType.STRING }, metrics: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } } } } }, required: ["teamName", "metrics"] } },
            workTeamByTeam: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { teamName: { type: schemaType.STRING }, metrics: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } } } } }, required: ["teamName", "metrics"] } },
            companySituationByTeam: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { teamName: { type: schemaType.STRING }, metrics: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } } } } }, required: ["teamName", "metrics"] } }
          },
          required: ["clientName", "teamEngagement", "workSituationByTeam", "supervisorByTeam", "workTeamByTeam", "companySituationByTeam"]
        }
      },
      required: ["mode", "reportMetadata", "satisfaction"]
    };
  }
};

export const analyzeDocument = async (base64Pdf: string, mode: AnalysisMode): Promise<FeedbackAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const promptUniversal = `
    DÔLEŽITÁ TECHNICKÁ ANALÝZA TABULIEK (Strany 4-13):
    Analyzujeme tabuľky, kde STĹPCE predstavujú tímy a RIADKY predstavujú otázky.
    Cieľ: Extrahovať presné desatinné čísla (napr. 3.45, 4.20) pre každý tím.

    ALGORITMUS PRE ČÍTANIE (Dodržuj presne):
    1. Krok: Nájdi hlavičku tabuľky a urob si zoznam tímov v poradí zľava doprava.
       (Príklad: Index 1 = Bratislava, Index 2 = Vedúci, Index 3 = Obchod...)
    
    2. Krok: Prejdi každý riadok s otázkou. V riadku uvidíš sériu čísel.
    
    3. Krok: MAPOVANIE PODĽA POZÍCIE:
       - Prvé nájdené číslo v riadku patrí tímu na Indexe 1.
       - Druhé nájdené číslo patrí tímu na Indexe 2.
       - Tretie číslo patrí tímu na Indexe 3.
       - A tak ďalej.
    
    4. Krok: Zapíš tieto hodnoty do JSONu. 
       Ak je v PDF číslo, MUSÍ byť aj v JSONe. Nenechávaj 0, ak tam vidíš hodnotu.
       
    Spracuj takto všetky 4 sekcie:
    - Pracovná situácia -> workSituationByTeam
    - Priamy nadriadený -> supervisorByTeam
    - Pracovný tím -> workTeamByTeam
    - Situácia vo firme -> companySituationByTeam

    Výstup: Kompletný VALIDNÝ JSON v slovenčine.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-preview-09-2025",
      contents: {
        role: "user",
        parts: [
          { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
          { text: mode === '360_FEEDBACK' ? "Analyzuj 360 spätnú väzbu." : promptUniversal }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
        temperature: 0.1, // Nízka teplota aby si nevymýšľal
        maxOutputTokens: 8192 // Dostatok priestoru pre všetky dáta
      }
    });

    const text = response.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(cleanJson) as FeedbackAnalysisResult;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Chyba analýzy: " + error.message);
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};;
