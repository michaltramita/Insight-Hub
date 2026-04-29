import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AppUserProfile,
  loadCurrentUserProfile,
} from "../services/accessControl";

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

    void loadCurrentUserProfile(user)
      .then((nextProfile) => {
        if (!isMounted) return;
        setProfile(nextProfile);
      })
      .catch((profileError: unknown) => {
        if (!isMounted) return;
        setError(
          profileError instanceof Error
            ? profileError.message
            : "Profil sa nepodarilo načítať."
        );
        setProfile(null);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

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
