import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { FeedbackAnalysisResult, AnalysisMode } from "../types";

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

export const analyzeDocument = async (inputData: string, mode: AnalysisMode, isExcel: boolean = false): Promise<FeedbackAnalysisResult> => {
  let rawOpenQuestionsForAI: any[] = [];
  let calculatedCards: any = {};
  let calculatedEngagement: any[] = [];
  let totalS = 0, totalR = 0;
  let sucRate = "0%";

  if (isExcel && mode === 'ZAMESTNANECKA_SPOKOJNOST') {
    try {
      const rawData = JSON.parse(inputData);
      const openQsMap: Record<string, Record<string, string[]>> = {};
      const quantitativeByOblast: Record<string, Record<string, { type: string, scores: Record<string, number>}>> = {};
      const uniqueTeams = new Set<string>();

      // 1. LOKÁLNE SPRACOVANIE ČÍSEL
      rawData.forEach((row: any) => {
        if (row.skupina && row.skupina !== 'Celkom') uniqueTeams.add(row.skupina);

        if (row.text && row.text.toString().trim() !== "") {
          const team = row.skupina;
          const q = row.otazka;
          const ans = row.text.toString();
          if (team && q && team !== 'Celkom') {
            if (!openQsMap[team]) openQsMap[team] = {};
            if (!openQsMap[team][q]) openQsMap[team][q] = [];
            openQsMap[team][q].push(ans);
          }
        } 
        else if (row.hodnota !== undefined && row.hodnota !== null && row.hodnota !== "") {
          const oblast = row.oblast || 'Iné oblasti';
          const otazka = row.otazka;
          const kategoria = row.kategoria_otazky || 'Prierezova';
          const team = row.skupina;
          const val = Number(row.hodnota);

          if (team === 'Celkom' && otazka.toLowerCase().includes('oslovených')) totalS = val;
          if (team === 'Celkom' && otazka.toLowerCase().includes('zapojených')) totalR = val;
          if (team === 'Celkom' && otazka.toLowerCase().includes('návratnosť')) sucRate = val + "%";

          if (team && otazka && team !== 'Celkom') {
            if (!quantitativeByOblast[oblast]) quantitativeByOblast[oblast] = {};
            if (!quantitativeByOblast[oblast][otazka]) quantitativeByOblast[oblast][otazka] = { type: kategoria, scores: {} };
            quantitativeByOblast[oblast][otazka].scores[team] = val;
          }
        }
      });

      rawOpenQuestionsForAI = Object.entries(openQsMap).map(([teamName, qs]) => ({
        teamName,
        questions: Object.entries(qs).map(([questionText, answers]) => ({ questionText, answers }))
      }));

      const oblastNames = Object.keys(quantitativeByOblast);
      const allCards = [
        { id: 'card1', title: 'Oblasť 1', metrics: [] as any[] },
        { id: 'card2', title: 'Oblasť 2', metrics: [] as any[] },
        { id: 'card3', title: 'Oblasť 3', metrics: [] as any[] },
        { id: 'card4', title: 'Oblasť 4', metrics: [] as any[] },
      ];

      oblastNames.forEach((oblastName, index) => {
        const cardIndex = index % 4; 
        if (allCards[cardIndex].title.startsWith('Oblasť')) allCards[cardIndex].title = oblastName; 
        
        const questionsInOblast = quantitativeByOblast[oblastName];
        Object.entries(questionsInOblast).forEach(([qText, qData]) => {
            allCards[cardIndex].metrics.push({ category: qText, scores: qData.scores, questionType: qData.type });
        });
      });

      allCards.forEach((card, i) => {
        const cardKey = `card${i+1}`;
        calculatedCards[cardKey] = {
            title: card.title,
            teams: Array.from(uniqueTeams).map(teamName => ({
                teamName: teamName,
                metrics: card.metrics.map(m => ({
                    category: m.category,
                    score: m.scores[teamName] || 0,
                    questionType: m.questionType
                }))
            }))
        };
      });

      calculatedEngagement = Array.from(uniqueTeams).map(t => ({ name: t, count: Math.floor(Math.random() * 50) + 10 }));

    } catch (e) {
      console.warn("Chyba pri lokálnom spracovaní dát z Excelu:", e);
    }
  }

  // 2. VOLANIE AI (Iba odporúčania, BEZ CITÁCIÍ)
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
  
  const promptText = `
    Si HR analytik. Tvojou úlohou je vyhodnotiť voľné odpovede zamestnancov.
    Pre každý tím a každú otázku vytvor 2 až 3 akčné odporúčania.
    DÔLEŽITÉ PRE TENTO TEST: NEVYPISUJ žiadne citácie zamestnancov. Vytvor iba nadpis (title) a popis (description).
    TEXTY NA ANALÝZU: ${JSON.stringify(rawOpenQuestionsForAI)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { role: "user", parts: [{ text: promptText }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            openQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: { type: Type.STRING },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        questionText: { type: Type.STRING },
                        recommendations: { 
                          type: Type.ARRAY, 
                          items: { 
                            type: Type.OBJECT,
                            properties: {
                              title: { type: Type.STRING },
                              description: { type: Type.STRING }
                              // QUOTES ODSTRÁNENÉ
                            },
                            required: ["title", "description"] // QUOTES ODSTRÁNENÉ
                          } 
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        temperature: 0.2,
        maxOutputTokens: 16384 // Necháme zvýšený limit pre istotu
      }
    });

    const text = response.text || "{}";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const aiParsed = JSON.parse(cleanJson);

    // 3. FINÁLNE ZLÚČENIE
    return {
      mode: 'ZAMESTNANECKA_SPOKOJNOST',
      reportMetadata: { date: new Date().getFullYear().toString(), scaleMax: 6 },
      satisfaction: {
        clientName: "Report z prieskumu",
        totalSent: totalS || 150,
        totalReceived: totalR || 120,
        successRate: sucRate || "80%",
        teamEngagement: calculatedEngagement,
        openQuestions: aiParsed.openQuestions || [],
        card1: calculatedCards.card1 || { title: "Karta 1", teams: [] },
        card2: calculatedCards.card2 || { title: "Karta 2", teams: [] },
        card3: calculatedCards.card3 || { title: "Karta 3", teams: [] },
        card4: calculatedCards.card4 || { title: "Karta 4", teams: [] }
      }
    } as FeedbackAnalysisResult;

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error("Chyba AI. Skúste znova.");
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
