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

type ThemeStat = {
  theme: string;
  count: number;
  percentage: number;
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

  const stats: ThemeStat[] = Object.entries(themeMap)
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
    // PRIDANÉ: Prijímame aj dáta o zapojení (engagementData)
    const { rawOpenQuestionsForAI, engagementData, firmSuccessRate } = req.body || {};

    if (!rawOpenQuestionsForAI || !Array.isArray(rawOpenQuestionsForAI)) {
      return res.status(400).json({ error: 'Missing or invalid rawOpenQuestionsForAI' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const enrichedInput: RawTeam[] = (rawOpenQuestionsForAI as RawTeam[]).map((team) => ({
      ...team,
      questions: (team.questions || []).map((q) => {
        const stats = buildThemeStats(q.answers || []);
        return {
          ...q,
          _meta: {
            totalAnswers: stats.totalAnswers,
            hasThemes: stats.hasThemes,
            themeStats: stats.themeStats,
          },
        } as any;
      }),
    }));

    // PRIDANÉ: Rozšírený prompt pre analýzu zapojenia
    const promptText = `
Si senior HR/People Analytics expert. Píšeš po slovensky.

Úloha má 2 časti:

ČASŤ 1: OTVORENÉ OTÁZKY
Pre každý tím a každú otázku vytvor presne 3 manažérske odporúčania.
- ODPORÚČANIA musia byť praktické, stručné a použiteľné.
- "themeCloud" NEGENERUJ do odporúčaní (je riešený inde).
- Uveď max 5 reprezentatívnych doslovných citácií z answers[].text.
- Nepíš žiadne vymyslené dáta.

ČASŤ 2: ZAPOJENIE TÍMOV (ENGAGEMENT)
Analyzuj dáta o návratnosti prieskumu. Celofiremná návratnosť je: ${firmSuccessRate || 'Neznáma'}.
Pre každý tím v "Dáta o zapojení tímov" napíš:
- aiSummary: Krátke zhodnotenie čísel v kontexte firmy (napr. "Tím tvorí 43% odpovedí celej firmy a dosahuje nadpriemernú návratnosť 75%.").
- aiRecommendation: Praktické manažérske odporúčanie, ako udržať alebo zlepšiť toto zapojenie do budúcna.

Dáta o zapojení tímov:
${JSON.stringify(engagementData || [])}

Vstupné dáta pre otvorené otázky:
${JSON.stringify(enrichedInput)}

Výstup musí byť výhradne validný JSON so štruktúrou definovanou v schéme.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { role: "user", parts: [{ text: promptText }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            // Pôvodná schéma pre otvorené otázky
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
                        recommendations: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              title: { type: Type.STRING },
                              description: { type: Type.STRING },
                              quotes: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                              }
                            },
                            required: ["title", "description", "quotes"]
                          }
                        }
                      },
                      required: ["questionText", "themeCloud", "recommendations"]
                    }
                  }
                },
                required: ["teamName", "questions"]
              }
            },
            // NOVÉ: Schéma pre hodnotenie zapojenia
            engagementAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: { type: Type.STRING },
                  aiSummary: { type: Type.STRING },
                  aiRecommendation: { type: Type.STRING }
                },
                required: ["teamName", "aiSummary", "aiRecommendation"]
              }
            }
          },
          required: ["openQuestions", "engagementAnalysis"]
        },
        temperature: 0.2
      }
    });

    const text = (response.text || "").trim();
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed: any = { openQuestions: [], engagementAnalysis: [] };
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = { openQuestions: [], engagementAnalysis: [] };
    }

    const metaLookup = new Map<string, { totalAnswers: number; themeStats: ThemeStat[] }>();

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
        teamName: String(team?.teamName || "").trim(),
        questions: (team?.questions || []).map((q: any) => {
          const key = `${String(team?.teamName || "").trim()}|||${String(q?.questionText || "").trim()}`;
          const meta = metaLookup.get(key);

          const normalizedThemeCloud =
            Array.isArray(meta?.themeStats) && meta!.themeStats.length > 0
              ? meta!.themeStats
                  .filter((t: any) => t?.theme)
                  .map((t: any) => ({
                    theme: String(t.theme).trim(),
                    count: Number(t.count) || 0,
                    percentage: Number(t.percentage) || 0,
                  }))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 8)
              : [];

          const normalizedRecommendations = (q?.recommendations || [])
            .slice(0, 3)
            .map((rec: any) => ({
              title: String(rec?.title || "Odporúčanie").trim(),
              description: String(rec?.description || "").trim(),
              quotes: Array.isArray(rec?.quotes)
                ? rec.quotes
                    .map((x: any) => String(x || "").trim())
                    .filter(Boolean)
                    .slice(0, 5)
                : [],
            }));

          return {
            questionText: String(q?.questionText || "").trim(),
            themeCloud: normalizedThemeCloud,
            recommendations: normalizedRecommendations,
          };
        }),
      }));
    }

    // Posielame späť obidva výsledky
    return res.status(200).json({
      openQuestions: parsed.openQuestions,
      engagementAnalysis: parsed.engagementAnalysis || []
    });
  } catch (error: any) {
    console.error("Serverless Gemini error:", error);
    return res.status(500).json({
      error: 'AI request failed',
      details: error?.message || 'Unknown error'
    });
  }
}
