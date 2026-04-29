import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let browserClient: ReturnType<typeof createClient> | null = null;
const authStorageKey = "libellius-insighthub-auth";

const assertSupabaseEnv = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase nie je nakonfigurovany. Doplňte VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY."
    );
  }
};

export const getSupabaseBrowserClient = () => {
  if (browserClient) return browserClient;

  assertSupabaseEnv();
  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: authStorageKey,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });

  return browserClient;
};

export const hasSupabaseEnv = () => Boolean(supabaseUrl && supabaseAnonKey);
