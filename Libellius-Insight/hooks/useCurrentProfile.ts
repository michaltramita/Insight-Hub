import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AppUserProfile,
  loadCurrentUserProfile,
} from "../services/accessControl";

const PROFILE_RETRY_DELAYS_MS = [0, 250, 800, 1800];

type CurrentProfileState = {
  profile: AppUserProfile | null;
  isLoading: boolean;
  error: string | null;
  isAdminLike: boolean;
};

export const useCurrentProfile = (user: User | null): CurrentProfileState => {
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setProfile(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const sleep = (ms: number) =>
      new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });

    void (async () => {
      try {
        let nextProfile: AppUserProfile | null = null;

        for (let attempt = 0; attempt < PROFILE_RETRY_DELAYS_MS.length; attempt += 1) {
          if (attempt > 0) {
            await sleep(PROFILE_RETRY_DELAYS_MS[attempt]);
            if (!isMounted) return;
          }

          nextProfile = await loadCurrentUserProfile(user);
          if (nextProfile) {
            break;
          }
        }

        if (!isMounted) return;
        setProfile(nextProfile);
      } catch (profileError: unknown) {
        if (!isMounted) return;
        setError(
          profileError instanceof Error
            ? profileError.message
            : "Profil sa nepodarilo načítať."
        );
        setProfile(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return {
    profile,
    isLoading,
    error,
    isAdminLike: profile?.role === "admin" || profile?.role === "consultant",
  };
};
