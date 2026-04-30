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
  groups: TypologyQuestionGroup[];
  completedAt: string | null;
  savedAnswers: TypologyAnswerMap;
  savedAt: string | null;
};

type TypologyTestRow = {
  id: string;
  title: string;
  description: string | null;
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
};

export type TypologyAnswerMap = Record<string, number>;

type TypologyAnswerRow = {
  question_id: string;
  score: number;
  updated_at: string;
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
    return "Test už bol odoslaný. Opakované vyplnenie nie je povolené.";
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
    return "Test momentálne nemáte sprístupnený.";
  }
  return message;
};

export const loadTypologyTest = async (
  user: User
): Promise<TypologyTest | null> => {
  const supabase = getSupabaseBrowserClient();

  const { data: tests, error: testError } = await supabase
    .from("typology_tests")
    .select("id, title, description")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (testError) {
    throw new Error(testError.message);
  }

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
    .select("id, status, completed_at")
    .eq("test_id", test.id)
    .eq("user_id", user.id)
    .limit(1);

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const session = (sessions?.[0] as TypologySessionRow | undefined) || null;
  const savedAnswers: TypologyAnswerMap = {};
  let savedAt: string | null = null;

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

  return {
    ...test,
    groups: groupQuestions((questions || []) as TypologyQuestionRow[]),
    completedAt: session?.status === "completed" ? session.completed_at : null,
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
