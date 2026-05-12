import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase";

export type TypologyStyleCode = "a" | "b" | "c" | "d";

export type TypologyQuestionOption = {
  id: string;
  questionNo: number;
  optionKey: "a" | "b" | "c" | "d";
  styleCode: TypologyStyleCode;
  statement: string;
  sortOrder: number;
};

export type TypologyQuestionGroup = {
  questionNo: number;
  options: TypologyQuestionOption[];
};

export type TypologyTest = {
  id: string;
  title: string;
  description: string | null;
  participantResultsAvailableAt: string | null;
  resultAccessScope: "project";
  participantResult: TypologyParticipantResult | null;
  groups: TypologyQuestionGroup[];
  completedAt: string | null;
  savedAnswers: TypologyAnswerMap;
  savedAt: string | null;
};

type TypologyTestRow = {
  id: string;
  title: string;
  description: string | null;
  participant_results_available_at: string | null;
};

type TypologyQuestionRow = {
  id: string;
  question_no: number;
  option_key: "a" | "b" | "c" | "d";
  style_code: TypologyStyleCode;
  statement: string;
  sort_order: number;
};

type TypologySessionRow = {
  id: string;
  status: "in_progress" | "completed";
  completed_at: string | null;
  profiles:
    | {
        email: string;
        full_name: string | null;
        company_name: string | null;
      }
    | null;
};

export type TypologyAnswerMap = Record<string, number>;

type TypologyAnswerRow = {
  question_id: string;
  score: number;
  updated_at: string;
};

export type TypologyParticipantResult = {
  sessionId: string;
  userEmail: string | null;
  fullName: string | null;
  companyName: string | null;
  scores: Record<TypologyStyleCode, number> | null;
  dominantStyle: TypologyStyleCode | null;
  calculatedAt: string | null;
};

type TypologyResultRow = {
  session_id: string;
  scores: Record<TypologyStyleCode, number> | null;
  dominant_style: TypologyStyleCode | null;
  calculated_at: string | null;
};

type ProjectReleaseRow = {
  company_projects:
    | {
        result_access_date: string | null;
      }
    | Array<{
        result_access_date: string | null;
      }>
    | null;
};

export type TypologyAdminResult = {
  sessionId: string;
  userEmail: string;
  fullName: string | null;
  companyName: string | null;
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string | null;
  scores: Record<TypologyStyleCode, number> | null;
  dominantStyle: TypologyStyleCode | null;
  calculatedAt: string | null;
};

type TypologyAdminSessionRow = {
  id: string;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  profiles:
    | {
        email: string;
        full_name: string | null;
        company_name: string | null;
      }
    | null;
  typology_results:
    | Array<{
        scores: Record<TypologyStyleCode, number> | null;
        dominant_style: TypologyStyleCode | null;
        calculated_at: string | null;
      }>
    | {
        scores: Record<TypologyStyleCode, number> | null;
        dominant_style: TypologyStyleCode | null;
        calculated_at: string | null;
      }
    | null;
};

type SupabaseSelectError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const TYPOLOGY_ANALYSIS_TITLE = "Analýza osobnostnej typológie";
const LEGACY_TYPOLOGY_TITLES = new Set([
  "Test typológie pri vedení ľudí",
  "Test typológie pri vedení ludí",
]);

const normalizeTypologyTitle = (title: string) =>
  LEGACY_TYPOLOGY_TITLES.has(title) ? TYPOLOGY_ANALYSIS_TITLE : title;

const includesReleaseColumnName = (value?: string) =>
  Boolean(value?.includes("participant_results_available_at"));

const isMissingParticipantReleaseColumnError = (error: SupabaseSelectError) =>
  error.code === "42703" ||
  includesReleaseColumnName(error.message) ||
  includesReleaseColumnName(error.details) ||
  includesReleaseColumnName(error.hint);

const hasReleasedAt = (releasedAt: string | null, now: Date) => {
  if (!releasedAt) return false;

  const releaseTime = Date.parse(releasedAt);
  return Number.isFinite(releaseTime) && releaseTime <= now.getTime();
};

const isMissingProjectReleaseSourceError = (error: SupabaseSelectError) => {
  const combined = `${error.code || ""} ${error.message || ""} ${
    error.details || ""
  } ${error.hint || ""}`.toLowerCase();

  return (
    combined.includes("company_project_participants") ||
    combined.includes("company_projects") ||
    combined.includes("result_access_date") ||
    combined.includes("does not exist") ||
    combined.includes("schema cache")
  );
};

const pickProjectReleaseDate = (
  rows: ProjectReleaseRow[],
  now: Date
): { releaseAt: string | null } => {
  if (!rows.length) {
    return { releaseAt: null };
  }

  const releaseDates = rows
    .map((row) => {
      const relation = row.company_projects;
      if (!relation) return null;
      if (Array.isArray(relation)) {
        return relation[0]?.result_access_date || null;
      }
      return relation.result_access_date || null;
    })
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!releaseDates.length) {
    return { releaseAt: null };
  }

  const releasedDates = releaseDates
    .filter((value) => hasReleasedAt(value, now))
    .sort();

  if (releasedDates.length > 0) {
    return { releaseAt: releasedDates[0] };
  }

  const futureDates = releaseDates
    .filter((value) => !hasReleasedAt(value, now))
    .sort();

  return { releaseAt: futureDates[0] || null };
};

export const canParticipantViewTypologyResult = (
  test: Pick<TypologyTest, "completedAt" | "participantResultsAvailableAt">,
  now: Date = new Date()
) => Boolean(test.completedAt && hasReleasedAt(test.participantResultsAvailableAt, now));

const isForbiddenSelectError = (error: { code?: string; message?: string }) => {
  const message = error.message || "";

  return (
    error.code === "42501" ||
    message.toLowerCase().includes("permission denied") ||
    message.toLowerCase().includes("row-level security")
  );
};

const toParticipantResult = (
  row: TypologyResultRow,
  session: TypologySessionRow,
  user: User
): TypologyParticipantResult => ({
  sessionId: row.session_id,
  userEmail: session.profiles?.email || user.email || null,
  fullName: session.profiles?.full_name || null,
  companyName: session.profiles?.company_name || null,
  scores: row.scores || null,
  dominantStyle: row.dominant_style || null,
  calculatedAt: row.calculated_at || null,
});

const groupQuestions = (rows: TypologyQuestionRow[]): TypologyQuestionGroup[] => {
  const groups = new Map<number, TypologyQuestionOption[]>();

  rows.forEach((row) => {
    const nextOption: TypologyQuestionOption = {
      id: row.id,
      questionNo: row.question_no,
      optionKey: row.option_key,
      styleCode: row.style_code,
      statement: row.statement,
      sortOrder: row.sort_order,
    };

    groups.set(row.question_no, [...(groups.get(row.question_no) || []), nextOption]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([questionNo, options]) => ({
      questionNo,
      options: options.sort((left, right) => left.sortOrder - right.sortOrder),
    }));
};

const readSubmitErrorMessage = (message: string) => {
  if (message.includes("typology_test_already_completed")) {
    return "Analýza už bola odoslaná. Opakované vyplnenie nie je povolené.";
  }
  if (message.includes("invalid_answers")) {
    return "Odpovede nie sú kompletné alebo nemajú správne rozdelenie hodnôt 1 až 4.";
  }
  if (
    message.includes("invalid_progress_answers") ||
    message.includes("invalid_answers_payload")
  ) {
    return "Rozpracované odpovede sa nepodarilo uložiť, pretože nemajú správny formát.";
  }
  if (
    message.includes("typology_access_denied") ||
    message.includes("typology_test_not_available")
  ) {
    return "Analýzu momentálne nemáte sprístupnenú.";
  }
  return message;
};

const loadActiveTypologyTests = async (): Promise<TypologyTestRow[]> => {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("typology_tests")
    .select("id, title, description, participant_results_available_at")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!error) {
    return (data || []) as TypologyTestRow[];
  }

  if (!isMissingParticipantReleaseColumnError(error)) {
    throw new Error(error.message);
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from("typology_tests")
    .select("id, title, description")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (legacyError) {
    throw new Error(legacyError.message);
  }

  return ((legacyData || []) as Array<Omit<TypologyTestRow, "participant_results_available_at">>).map(
    (row) => ({
      ...row,
      participant_results_available_at: null,
    })
  );
};

export const loadTypologyTest = async (
  user: User
): Promise<TypologyTest | null> => {
  const supabase = getSupabaseBrowserClient();
  const now = new Date();

  const tests = await loadActiveTypologyTests();
  const test = (tests?.[0] as TypologyTestRow | undefined) || null;
  if (!test) return null;

  const { data: questions, error: questionError } = await supabase
    .from("typology_questions")
    .select("id, question_no, option_key, style_code, statement, sort_order")
    .eq("test_id", test.id)
    .order("sort_order", { ascending: true });

  if (questionError) {
    throw new Error(questionError.message);
  }

  const { data: sessions, error: sessionError } = await supabase
    .from("typology_sessions")
    .select("id, status, completed_at, profiles(email, full_name, company_name)")
    .eq("test_id", test.id)
    .eq("user_id", user.id)
    .limit(1);

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const session = (sessions?.[0] as TypologySessionRow | undefined) || null;
  const savedAnswers: TypologyAnswerMap = {};
  let savedAt: string | null = null;
  let participantResult: TypologyParticipantResult | null = null;

  if (session?.status === "in_progress") {
    const { data: answerRows, error: answerError } = await supabase
      .from("typology_answers")
      .select("question_id, score, updated_at")
      .eq("session_id", session.id);

    if (answerError) {
      throw new Error(answerError.message);
    }

    ((answerRows || []) as TypologyAnswerRow[]).forEach((row) => {
      savedAnswers[row.question_id] = row.score;
      if (!savedAt || row.updated_at > savedAt) {
        savedAt = row.updated_at;
      }
    });
  }

  const completedAt = session?.status === "completed" ? session.completed_at : null;
  let participantResultsAvailableAt: string | null = null;
  const resultAccessScope: "project" = "project";

  const { data: projectReleaseRows, error: projectReleaseError } = await supabase
    .from("company_project_participants")
    .select("company_projects(result_access_date)")
    .eq("user_id", user.id);

  if (projectReleaseError) {
    if (!isMissingProjectReleaseSourceError(projectReleaseError)) {
      throw new Error(projectReleaseError.message);
    }
  } else {
    const projectReleaseState = pickProjectReleaseDate(
      (projectReleaseRows || []) as ProjectReleaseRow[],
      now
    );
    participantResultsAvailableAt = projectReleaseState.releaseAt;
  }

  const canViewParticipantResult = canParticipantViewTypologyResult({
    completedAt,
    participantResultsAvailableAt,
  }, now);

  if (session?.status === "completed") {
    const { data: resultRow, error: resultError } = await supabase
      .from("typology_results")
      .select("session_id, scores, dominant_style, calculated_at")
      .eq("session_id", session.id)
      .maybeSingle();

    if (resultError) {
      if (canViewParticipantResult && !isForbiddenSelectError(resultError)) {
        throw new Error(resultError.message);
      }
    } else if (canViewParticipantResult && resultRow) {
      participantResult = toParticipantResult(
        resultRow as TypologyResultRow,
        session,
        user
      );
    }
  }

  return {
    id: test.id,
    title: normalizeTypologyTitle(test.title),
    description: test.description,
    participantResultsAvailableAt,
    resultAccessScope,
    participantResult,
    groups: groupQuestions((questions || []) as TypologyQuestionRow[]),
    completedAt,
    savedAnswers,
    savedAt,
  };
};

export const saveTypologyProgress = async (
  user: User,
  test: TypologyTest,
  answers: TypologyAnswerMap
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  if (!user?.id) {
    throw new Error("Nie ste prihlásený.");
  }

  const { error } = await db.rpc("save_typology_progress", {
    p_test_id: test.id,
    p_answers: answers,
  });

  if (error) {
    throw new Error(readSubmitErrorMessage(error.message));
  }
};

export const submitTypologyTest = async (
  user: User,
  test: TypologyTest,
  answers: TypologyAnswerMap
) => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  if (!user?.id) {
    throw new Error("Nie ste prihlásený.");
  }

  const { error } = await db.rpc("submit_typology_test", {
    p_test_id: test.id,
    p_answers: answers,
  });

  if (error) {
    throw new Error(readSubmitErrorMessage(error.message));
  }
};

export const loadTypologyAdminResults = async (): Promise<TypologyAdminResult[]> => {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("typology_sessions")
    .select(
      "id, status, started_at, completed_at, profiles(email, full_name, company_name), typology_results(scores, dominant_style, calculated_at)"
    )
    .order("completed_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as TypologyAdminSessionRow[]).map((row) => {
    const result = Array.isArray(row.typology_results)
      ? row.typology_results[0] || null
      : row.typology_results;

    return {
      sessionId: row.id,
      userEmail: row.profiles?.email || "Neznámy používateľ",
      fullName: row.profiles?.full_name || null,
      companyName: row.profiles?.company_name || null,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      scores: result?.scores || null,
      dominantStyle: result?.dominant_style || null,
      calculatedAt: result?.calculated_at || null,
    };
  });
};
