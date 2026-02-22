import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

type RawAnswer = {
  text?: string;
  tema?: string;
};

type RawQuestion = {
  questionText: string;
  answers: Array<string | RawAnswer>;
};

type RawTeam = {
  teamName: string;
  questions: RawQuestion[];
};

function normalizeTheme(theme: string): string {
  return String(theme || "").trim();
}

function buildThemeStats(answers: Array<string | RawAnswer>) {
  const totalAnswers = Array.isArray(answers) ? answers.length : 0;

  const themeMap: Record<string, number> = {};

  for (const ans of answers || []) {
    const tema = typeof ans === "string" ? "" : normalizeTheme(ans.tema || "");
    if (!tema) continue;
    themeMap[tema] = (themeMap[tema] || 0) + 1;
  }

  const stats = Object.entries(themeMap)
    .map(([theme, count]) => ({
      theme,
      count,
      percentage: totalAnswers > 0 ? Number(((count / totalAnswers) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalAnswers,
    themeStats: stats,
    hasThemes: stats.length > 0,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rawOpenQuestionsForAI } = req.body || {};

    if (!rawOpenQuestionsForAI || !Array.isArray(rawOpenQuestionsForAI)) {
      return res.status(400).json({ error: 'Missing or invalid rawOpenQuestionsForAI' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 1) Predspracovanie: dopočítame theme stats (spoľahlivo na serveri, nie cez AI)
    const enrichedInput: RawTeam[] = (rawOpenQuestionsForAI as RawTeam[]).map((team) => ({
      ...team,
      questions: (team.questions || []).map((q) => {
        const stats = buildThemeStats(q.answers || []);
        return {
          ...q,
          _meta: {
            totalAnswers: stats.totalAnswers,
            hasThemes: stats.hasThemes,
            themeStats: stats.themeStats, // [{theme,count,percentage}]
          },
        } as any;
      }),
    }));

    // 2) Prompt: AI rieši obsah odporúčaní + výber citácií, NIE presné počty tém
    const promptText = `
Si senior HR/People Analytics expert.

Úloha:
Pre každý tím a každú otázku vytvor presne 3 manažérske odporúčania.

Dôležité pravidlá:
1. ODPORÚČANIA musia byť praktické, stručné a použiteľné pre manažment.
2. AI NESMIE počítať výskyty tém sama. Počty a podiely tém sú už pripravené v "_meta.themeStats".
3. Ak sú dostupné témy v "_meta.themeStats", ku každému odporúčaniu priraď:
   - "themeCloud": 3 až 8 najrelevantnejších tém z _meta.themeStats
   - každá položka musí mať "theme", "count", "percentage"
4. "quotes":
   - Ak je odpovedí málo (napr. do 20), uveď 3 až 5 priamych citácií.
   - Ak je odpovedí veľa, uveď max 5 reprezentatívnych citácií (nie je nutné 3 presne).
   - Citácie musia byť doslovné texty z odpovedí (pole answers[].text alebo string answers[]).
5. Nepíš žiadne vymyslené dáta, žiadne nové počty, žiadne nové témy.
6. Výstup iba validné JSON podľa schémy.

Vstupné dáta:
${JSON.stringify(enrichedInput)}
`.trim();

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
                              description: { type: Type.STRING },

                              // Theme cloud pre rozkliknuté odporúčanie
                              themeCloud: {
                                type: Type.ARRAY,
                                items: {
                                  type: Type.OBJECT,
                                  properties: {
                                    theme: { type: Type.STRING },
                                    count: { type: Type.NUMBER },
                                    percentage: { type: Type.NUMBER }
                                  },
                                  required: ["theme", "count", "percentage"]
                                }
                              },

                              // Max 5 reprezentatívnych citácií (nie povinne vždy 3)
                              quotes: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                              }
                            },
                            required: ["title", "description", "themeCloud", "quotes"]
                          }
                        }
                      },
                      required: ["questionText", "recommendations"]
                    }
                  }
                },
                required: ["teamName", "questions"]
              }
            }
          },
          required: ["openQuestions"]
        },
        temperature: 0.2
      }
    });

    const text = (response.text || "").trim();
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed: any = { openQuestions: [] };
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = { openQuestions: [] };
    }

    // 3) Bezpečnostný fallback: ak AI nevráti themeCloud, doplníme ho zo serverových dát
    //    (aspoň top 5 tém) a quotes necháme prázdne ak chýbajú
    const metaLookup = new Map<string, { totalAnswers: number; themeStats: any[] }>();

    for (const team of enrichedInput as any[]) {
      for (const q of team.questions || []) {
        const key = `${team.teamName}|||${q.questionText}`;
        metaLookup.set(key, {
          totalAnswers: q._meta?.totalAnswers || 0,
          themeStats: q._meta?.themeStats || [],
        });
      }
    }

    if (Array.isArray(parsed.openQuestions)) {
      parsed.openQuestions = parsed.openQuestions.map((team: any) => ({
        ...team,
        questions: (team.questions || []).map((q: any) => {
          const key = `${team.teamName}|||${q.questionText}`;
          const meta = metaLookup.get(key);

          return {
            ...q,
            recommendations: (q.recommendations || []).slice(0, 3).map((rec: any) => ({
              title: String(rec?.title || "Odporúčanie").trim(),
              description: String(rec?.description || "").trim(),

              themeCloud:
                Array.isArray(rec?.themeCloud) && rec.themeCloud.length > 0
                  ? rec.themeCloud
                      .filter((t: any) => t?.theme)
                      .map((t: any) => ({
                        theme: String(t.theme).trim(),
                        count: Number(t.count) || 0,
                        percentage: Number(t.percentage) || 0,
                      }))
                      .sort((a: any, b: any) => b.count - a.count)
                  : (meta?.themeStats || []).slice(0, 5),

              quotes: Array.isArray(rec?.quotes)
                ? rec.quotes
                    .map((x: any) => String(x || "").trim())
                    .filter(Boolean)
                    .slice(0, 5)
                : [],
            })),
          };
        }),
      }));
    }

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Serverless Gemini error:", error);
    return res.status(500).json({
      error: 'AI request failed',
      details: error?.message || 'Unknown error'
    });
  }
}
