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
    // Schéma pre spokojnosť
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
          required: ["clientName", "workSituationByTeam", "supervisorByTeam", "workTeamByTeam", "companySituationByTeam"]
        }
      },
      required: ["mode", "reportMetadata", "satisfaction"]
    };
  }
};

export const analyzeDocument = async (base64Pdf: string, mode: AnalysisMode): Promise<FeedbackAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const promptUniversal = `
    DÔLEŽITÁ ANALÝZA MATICOVÝCH TABULIEK (Strany 4-13):
    Tabuľky obsahujú číselné hodnoty (napr. 4.25, 3.80). Riadky sú otázky, stĺpce sú tímy.

    POSTUP "INDEXOVANIA STĹPCOV" (Kritické pre správne čísla):
    1. Najprv si vypíš poradie tímov v hlavičke tabuľky zľava doprava (napr. Index 1: Tím A, Index 2: Tím B...).
    2. V každom riadku s otázkou nájdeš sériu čísel.
    3. Prvé číslo patrí tímu s Indexom 1. Druhé číslo patrí tímu s Indexom 2, atď.
    4. MUSÍŠ extrahovať tieto čísla. Ak vidíš v bunke číslo, priraď ho. Nenechávaj hodnotu 0, ak je v PDF číslo.

    ŠTRUKTÚRA DÁT:
    Pre KAŽDÝ identifikovaný tím naplň jeho objekt 'metrics' (kategória + skóre) pre sekcie:
    - Work Situation (Pracovná situácia)
    - Supervisor (Priamy nadriadený)
    - Work Team (Pracovný tím)
    - Company Situation (Situácia vo firme)

    Daj si pozor, aby si nevynechal čísla pre tímy v strede tabuľky. Každý tím musí mať vyplnené 'score'.
    Výstup: VALIDNÝ JSON.
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
        temperature: 0.1, // Nízka teplota je kľúčová pre presnosť čísel
        maxOutputTokens: 8192
      }
    });

    const text = response.text || "";
    // Odstránenie markdown značiek
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(cleanJson) as FeedbackAnalysisResult;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Chyba pri analýze dokumentu: " + error.message);
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
