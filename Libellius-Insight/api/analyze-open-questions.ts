import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

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

    const promptText = `Si HR expert. Prečítaj si tieto voľné odpovede a pre každý tím a otázku vytvor 3 manažérske odporúčania s 3 citáciami.\nTEXTY NA ANALÝZU: ${JSON.stringify(rawOpenQuestionsForAI)}`;

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
                              quotes: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ["title", "description", "quotes"]
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

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Serverless Gemini error:", error);
    return res.status(500).json({ error: 'AI request failed', details: error?.message || 'Unknown error' });
  }
}
