import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AppModuleAssignment,
  AppModuleCode,
  loadActiveModuleAssignments,
} from "../services/accessControl";

type ModuleAssignmentState = {
  assignments: AppModuleAssignment[];
  isLoading: boolean;
  error: string | null;
  hasModule: (code: AppModuleCode) => boolean;
};

export const useModuleAssignments = (user: User | null): ModuleAssignmentState => {
  const [assignments, setAssignments] = useState<AppModuleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setAssignments([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    void loadActiveModuleAssignments(user)
      .then((nextAssignments) => {
        if (!isMounted) return;
        setAssignments(nextAssignments);
      })
      .catch((assignmentError: unknown) => {
        if (!isMounted) return;
        setError(
          assignmentError instanceof Error
            ? assignmentError.message
            : "Nepodarilo sa načítať prístupové nastavenia."
        );
        setAssignments([]);
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

  const hasModule = (code: AppModuleCode) =>
    assignments.some((assignment) => assignment.code === code);

  return {
    assignments,
    isLoading,
    error,
    hasModule,
  };
};
