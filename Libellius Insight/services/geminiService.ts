import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

// --- 1. POMOCNÁ FUNKCIA NA KONVERZIU EXCELU ---
export const parseExcelFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        let combinedText = "";

        // Prejdeme všetky hárky (Situácia vo firme, Pracovný tím, atď.)
        workbook.SheetNames.forEach(name => {
          const sheet = workbook.Sheets[name];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          combinedText += `\n### SEKCOA: ${name} ###\n${csv}\n`;
        });

        // DÔLEŽITÉ: Prevod slovenských čiarok (4,56) na bodky (4.56)
        const normalizedText = combinedText.replace(/(\d+),(\d+)/g, '$1.$2');
        
        resolve(normalizedText);
      } catch (err) {
        reject(new Error("Chyba pri čítaní Excelu."));
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

// --- 2. POMOCNÁ FUNKCIA NA KONVERZIU PDF ---
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};

// --- 3. DEFINÍCIA SCHÉMY PRE GEMINI ---
const getSchema = (mode: AnalysisMode) => {
  const schemaType = Type;
  const is360 = mode === '360_FEEDBACK';

  if (is360) {
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
              competencies: {
                type: schemaType.ARRAY,
                items: {
                  type: schemaType.OBJECT,
                  properties: { name: { type: schemaType.STRING }, selfScore: { type: schemaType.NUMBER }, othersScore: { type: schemaType.NUMBER } },
                  required: ["name", "selfScore", "othersScore"]
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
  }

  // Schéma pre PRIESKUM SPOKOJNOSTI (tvoj prípad s tímami)
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
              required: ["name", "count"]
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
                    properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } }
                  }
                }
              }
            }
          },
          supervisorByTeam: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { teamName: { type: schemaType.STRING }, metrics: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } } } } } } },
          workTeamByTeam: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { teamName: { type: schemaType.STRING }, metrics: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } } } } } } },
          companySituationByTeam: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { teamName: { type: schemaType.STRING }, metrics: { type: schemaType.ARRAY, items: { type: schemaType.OBJECT, properties: { category: { type: schemaType.STRING }, score: { type: schemaType.NUMBER } } } } } } }
        }
      }
    }
  };
};

// --- 4. ANALÝZA ---
export const analyzeDocument = async (
  inputData: string, 
  mode: AnalysisMode,
  isExcel: boolean = false
): Promise<FeedbackAnalysisResult> => {
  
  const genAI = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  
  const prompt = mode === '360_FEEDBACK' 
    ? "Analyzuj 360 feedback." 
    : `Si HR analytik. Analyzuj CSV dáta z prieskumu spokojnosti. 
       Tímy sú v stĺpcoch (Obchod, Bratislava, Vedúci...). 
       Extrahuj priemerné skóre (0-6) pre každú kategóriu na každom hárku. 
       Vráť čistý JSON podľa schémy.`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      generationConfig: { responseMimeType: "application/json", responseSchema: getSchema(mode), temperature: 0.1 }
    });

    const contents = isExcel 
      ? [{ role: "user", parts: [{ text: `${prompt}\n\nDÁTA:\n${inputData}` }] }]
      : [{ role: "user", parts: [{ inlineData: { data: inputData, mimeType: "application/pdf" } }, { text: prompt }] }];

    const result = await model.generateContent({ contents });
    return JSON.parse(result.response.text()) as FeedbackAnalysisResult;

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error("Nepodarilo sa vykonať analýzu.");
  }
};
