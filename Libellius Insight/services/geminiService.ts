import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
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
                  properties: { 
                    category: { type: schemaType.STRING }, 
                    score: { type: schemaType.NUMBER },
                    questionType: { type: schemaType.STRING } 
                  },
                  required: ["category", "score", "questionType"]
                }
              }
            },
            required: ["teamName", "metrics"]
          }
        }
      },
      required: ["title", "teams"]
    };

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
                recommendations: { 
                  type: schemaType.ARRAY, 
                  items: { 
                    type: schemaType.OBJECT,
                    properties: {
                      title: { type: schemaType.STRING },
                      description: { type: schemaType.STRING },
                      quotes: { type: schemaType.ARRAY, items: { type: schemaType.STRING } }
                    },
                    required: ["title", "description", "quotes"]
                  } 
                }
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

export const parseExcelFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        const simplifiedData = jsonData.map(row => ({
          skupina: row['skupina'] || row['Skupina'],
          otazka: row['otazka'] || row['Otazka'],
          hodnota: row['hodnota'],
          text: row['text_odpovede'], 
          oblast: row['oblast'] || row['typ'],
          kategoria_otazky: row['kategoria_otazky'] || row['Kategoria_otazky'] || 'Prierezova'
        }));

        resolve(JSON.stringify(simplifiedData));
      } catch (err) {
        reject(new Error("Nepodarilo sa prečítať Excel súbor."));
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

export const analyzeDocument = async (
  inputData: string, 
  mode: AnalysisMode,
  isExcel: boolean = false
): Promise<FeedbackAnalysisResult> => {

  let rawOpenQuestionsForAI: any[] = [];
  let aiInputData = inputData;
  let teamsListString = "";

  if (isExcel && mode === 'ZAMESTNANECKA_SPOKOJNOST') {
    try {
      const rawData = JSON.parse(inputData);
      const openQsMap: Record<string, Record<string, string[]>> = {};
      const filteredForAi: any[] = [];
      const uniqueTeams = new Set<string>();

      rawData.forEach((row: any) => {
        if (row.skupina && row.skupina !== 'Celkom') {
           uniqueTeams.add(row.skupina);
        }

        if (row.text && row.text.toString().trim() !== "") {
          const team = row.skupina;
          const q = row.otazka;
          const ans = row.text.toString();
          
          if (team && q) {
            if (!openQsMap[team]) openQsMap[team] = {};
            if (!openQsMap[team][q]) openQsMap[team][q] = [];
            openQsMap[team][q].push(ans);
          }
        } 
        else if (row.hodnota !== undefined && row.hodnota !== null && row.hodnota !== "") {
          filteredForAi.push(row);
        }
      });

      teamsListString = Array.from(uniqueTeams).join(", ");

      rawOpenQuestionsForAI = Object.entries(openQsMap).map(([teamName, qs]) => ({
        teamName,
        questions: Object.entries(qs).map(([questionText, answers]) => ({
          questionText,
          answers
        }))
      }));

      aiInputData = JSON.stringify(filteredForAi);
    } catch (e) {
      console.warn("Chyba pri manuálnej extrakcii textov", e);
    }
  }

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const promptSatisfaction = `
    Si precízny HR analytik. Spracuj priložené dáta z prieskumu spokojnosti.

    DÔLEŽITÉ - ZOZNAM TÍMOV V DÁTACH:
    ${teamsListString}

    TEXTOVÉ ODPOVEDE NA ANALÝZU ODPORÚČANÍ (JSON):
    ${JSON.stringify(rawOpenQuestionsForAI)}
    
    1. METRIKY (KARTY 1-4):
       - Dáta sú rozdelené do viacerých oblastí (kľúč 'oblast'). Rozdeľ tieto oblasti logicky do 4 kariet (card1, card2, card3, card4).
       - V rámci každej karty vytvor záznam pre KAŽDÝ JEDEN TÍM.
       - KRITICKÉ: Do poľa 'metrics' musíš vložiť ÚPLNE VŠETKY tvrdenia, ktoré sa nachádzajú v dátach. Nesmieš vynechať ani jedno! 
       - PONECHAJ ICH V ICH PÔVODNOM, PRESNOM ZNENÍ tak, ako sú v dátach. Nezkracuj ich!
       - 'score' = priemer hodnôt pre daný tím a tvrdenie.
       - 'questionType' = Priraď hodnotu zo stĺpca 'kategoria_otazky' presne tak ako je v dátach ('Prierezova' alebo 'Specificka').

    2. ÚČASŤ (teamEngagement):
       - Vytvor záznam pre každý tím. 'totalSent', 'totalReceived', 'successRate' vytiahni zo skupiny 'Celkom'.

    3. VOĽNÉ OTÁZKY - ODPORÚČANIA A CITÁCIE (openQuestions):
       - Pozorne si prečítaj odpovede zamestnancov a pre KAŽDÝ TÍM a KAŽDÚ OTÁZKU sformuluj PRESNE 3 AKČNÉ ODPORÚČANIA s popisom a citáciami.
       - 'title': Krátky, úderný názov.
       - 'description': Detailný popis.
       - 'quotes': Vyber presne 5-10 reálnych citácií.
  `;

  try {
    const basePrompt = mode === '360_FEEDBACK' ? "Analyzuj 360-stupňovú spätnú väzbu." : promptSatisfaction;
    
    const parts = [{ text: isExcel ? `${basePrompt}\n\nDÁTA NA ANALÝZU:\n${aiInputData}` : basePrompt }];

    if (!isExcel && aiInputData) {
      parts.push({ inlineData: { data: aiInputData, mimeType: "application/pdf" } } as any);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { role: "user", parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: getSchema(mode),
        temperature: 0.1, // Znížená teplota pre maximálnu presnosť pri extrakcii
        maxOutputTokens: 8192 // Extrémne dôležité: Dovolí AI vygenerovať obrovský JSON bez odseknutia
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

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
