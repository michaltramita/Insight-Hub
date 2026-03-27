import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { analyzeOpenQuestionsPayload } from './api/analyze-open-questions-core';

const readJsonBody = async (req: IncomingMessage) => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
};

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const localOpenQuestionsApiPlugin = (apiKey: string): Plugin => ({
  name: 'local-open-questions-api',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/analyze-open-questions', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      try {
        if (!apiKey) {
          sendJson(res, 500, { error: 'Missing GEMINI_API_KEY on local server' });
          return;
        }

        const body = await readJsonBody(req);
        const parsed = await analyzeOpenQuestionsPayload(
          body?.rawOpenQuestionsForAI,
          apiKey
        );

        sendJson(res, 200, parsed);
      } catch (error: any) {
        console.error('Local API error /api/analyze-open-questions:', error);
        sendJson(res, 500, {
          error: 'AI request failed',
          details: error?.message || 'Unknown error',
        });
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), localOpenQuestionsApiPlugin(env.GEMINI_API_KEY)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
