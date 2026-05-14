import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from './vercel-types.js';

const readSupabaseApiConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
});

export const readBearerToken = (req: VercelRequest) => {
  const rawHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const match = String(rawHeader || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const requireAuthenticatedUser = async (req: VercelRequest) => {
  const token = readBearerToken(req);
  if (!token) return null;

  const { url, anonKey } = readSupabaseApiConfig();
  if (!url || !anonKey) {
    throw new Error('Supabase Auth nie je nakonfigurovaný pre API endpoint.');
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) return null;
  return data.user;
};

export const isGlobalAdminRequest = async (req: VercelRequest) => {
  const token = readBearerToken(req);
  if (!token) return false;

  const { url, anonKey } = readSupabaseApiConfig();
  if (!url || !anonKey) {
    throw new Error('Supabase Auth nie je nakonfigurovaný pre API endpoint.');
  }

  const supabase = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await supabase.rpc('is_global_admin');
  return !error && data === true;
};
