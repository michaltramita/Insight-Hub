import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rawOpenQuestionsForAI } = req.body || {};

    if (!rawOpenQuestionsForAI || !Array.isArray(rawOpenQuestionsForAI)) {
      return res.status(400).json({ error: 'Missing rawOpenQuestionsForAI array' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server' });
    }

    const promptText = `
Si HR expert. Prečítaj si tieto voľné odpovede a pre každý tím a otázku vytvor 3 manažérske odporúčania s 3 citáciami.
Vráť odpoveď striktne ako JSON v tvare:
{
  "openQuestions": [
    {
      "teamName": "string",
      "questions": [
        {
          "questionText": "string",
          "recommendations": [
            {
              "title": "string",
              "description": "string",
              "quotes": ["string", "string", "string"]
            }
          ]
        }
      ]
    }
  ]
}

TEXTY NA ANALÝZU:
${JSON.stringify(rawOpenQuestionsForAI)}
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(500).json({ error: 'Gemini request failed', details: data });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '{"openQuestions": []}';

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch {
      parsed = { openQuestions: [] };
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Server error',
      details: err?.message || 'Unknown error'
    });
  }
}
