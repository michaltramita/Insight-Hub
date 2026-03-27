import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeOpenQuestionsPayload } from './analyze-open-questions-core.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rawOpenQuestionsForAI } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    const parsed = await analyzeOpenQuestionsPayload(rawOpenQuestionsForAI, apiKey || '');
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Serverless Gemini error:", error);
    return res.status(500).json({
      error: 'AI request failed',
      details: error?.message || 'Unknown error'
    });
  }
}
