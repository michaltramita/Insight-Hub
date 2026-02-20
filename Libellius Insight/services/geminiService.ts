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
  let totalQCount = 0;

  if (isExcel && mode === 'ZAMESTNANECKA_SPOKOJNOST') {
    try {
      const rawData = JSON.parse(inputData);
      const openQsMap: Record<string, Record<string, string[]>> = {};
      const uniqueTeams = new Set<string>();
      
      // Zoskupenie kvantitatívnych dát priamo v kóde (aby ich AI nemusela lúštiť z poľa)
      const quantitativeByOblast: Record<string, Record<string, { type: string, scores: Record<string, number>}>> = {};

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
          const oblast = row.oblast || 'Nezaradená oblasť';
          const otazka = row.otazka;
          const kategoria = row.kategoria_otazky || row.Kategoria_otazky || 'Prierezova';
          const team = row.skupina;
          const val = Number(row.hodnota);

          if (team && otazka) {
            if (!quantitativeByOblast[oblast]) quantitativeByOblast[oblast] = {};
            if (!quantitativeByOblast[oblast][otazka]) quantitativeByOblast[oblast][otazka] = { type: kategoria, scores: {} };
            quantitativeByOblast[oblast][otazka].scores[team] = val;
          }
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

      // Vygenerovanie absolútne blbovzdorného stringu pre AI
      let structuredQuantitativeData = "=== KVANTITATÍVNE DÁTA ===\n";
      for (const [oblast, otazky] of Object.entries(quantitativeByOblast)) {
         structuredQuantitativeData += `\nOBLASŤ: "${oblast}"\n`;
         for (const [otazka, data] of Object.entries(otazky)) {
             totalQCount++;
             structuredQuantitativeData += `  - Tvrdenie: "${otazka}" (Kategória: ${data.type})\n`;
             structuredQuantitativeData += `    Hodnotenia tímov: ${Object.entries(data.scores).map(([team, score]) => `${team}: ${score}`).join(', ')}\n`;
         }
      }

      aiInputData = structuredQuantitativeData;
    } catch (e) {
      console.warn("Chyba pri manuálnej extrakcii textov", e);
    }
  }

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const promptSatisfaction = `
    Si mimoriadne precízny dátový HR analytik.

    ZOZNAM TÍMOV: ${teamsListString}
    CELKOVÝ POČET TVRDENÍ NA SPRACOVANIE: ${totalQCount}
    
    1. METRIKY (KARTY 1-4):
       - Dáta máš prichystané v bloku 'KVANTITATÍVNE DÁTA'.
       - Rozdeľ oblasti z dát logicky do 4 kariet (card1, card2, card3, card4) a vymysli im vhodný názov ('title').
       - V každej karte vytvor objekt pre každý jeden tím.
       - KRITICKÉ PRAVIDLO: ZAKAZUJEM TI SKRACOVAŤ ZOZNAM OTÁZOK! V dátach je presne ${totalQCount} tvrdení. Musíš vypísať ÚPLNE VŠETKY do polí 'metrics'. Prekontroluj sa na konci, či tvoj výstup obsahuje presne ${totalQCount} metrík.
       - 'category' = Pôvodný text tvrdenia.
       - 'score' = Skóre pre daný tím.
       - 'questionType' = Priraď kategóriu (Prierezova/Specificka) presne podľa vstupu.

    2. ÚČASŤ (teamEngagement):
       - Vytvor záznam pre každý tím. Údaje o účasti si odhadni alebo vytiahni zo základných dát.

    3. VOĽNÉ OTÁZKY - ODPORÚČANIA A CITÁCIE:
       - Pozorne si prečítaj odpovede zamestnancov. Pre KAŽDÝ TÍM a KAŽDÚ OTÁZKU sformuluj PRESNE 3 AKČNÉ ODPORÚČANIA.
       - 'title': Krátky názov.
       - 'description': Detailný popis.
       - 'quotes': Vyber 5-10 reálnych citácií z dát.
       
    TEXTOVÉ ODPOVEDE (Otvorené otázky):
    ${JSON.stringify(rawOpenQuestionsForAI)}
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
        temperature: 0.1, // Minimalizujeme kreativitu pri kopírovaní dát
        maxOutputTokens: 8192 // Dôležité: Dovolí jej to vygenerovať plný, obrovský JSON bez odseknutia
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
