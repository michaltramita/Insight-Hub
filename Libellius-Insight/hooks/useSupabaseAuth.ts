import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "../lib/supabase";

type UseSupabaseAuthResult = {
  isConfigured: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  error: string | null;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const useSupabaseAuth = (): UseSupabaseAuthResult => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(hasSupabaseEnv());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!isMounted) return;

        if (sessionError) {
          setError(sessionError.message);
        }

        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      })
      .catch((sessionError: unknown) => {
        if (!isMounted) return;
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Nepodarilo sa načítať stav prihlásenia."
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setError(null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = async (email: string) => {
    if (!hasSupabaseEnv()) {
      return { error: "Supabase nie je nakonfigurovaný." };
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return { error: "Zadajte email pre prihlásenie." };
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const signInWithPassword = async (email: string, password: string) => {
    if (!hasSupabaseEnv()) {
      return { error: "Supabase nie je nakonfigurovaný." };
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return { error: "Zadajte email aj heslo." };
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const updatePassword = async (password: string) => {
    if (!hasSupabaseEnv()) {
      return { error: "Supabase nie je nakonfigurovaný." };
    }

    if (password.length < 8) {
      return { error: "Heslo musí mať aspoň 8 znakov." };
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const signOut = async () => {
    if (!hasSupabaseEnv()) return;

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }

    setSession(null);
    setUser(null);
  };

  return {
    isConfigured: hasSupabaseEnv(),
    isLoading,
    user,
    session,
    error,
    signInWithMagicLink,
    signInWithPassword,
    updatePassword,
    signOut,
  };
};
