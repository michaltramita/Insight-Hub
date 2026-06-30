import { getSupabaseBrowserClient } from "../lib/supabase";
import type { FeedbackAnalysisResult } from "../types";

export type Feedback360ReportStatus = "draft" | "published" | "archived";

export type Feedback360ReportSummary = {
  evaluatedPersons: number;
  participantsTotal: number | null;
  completedResponses: number | null;
  successRate: number | null;
  competenciesCount: number;
  scaleMax: number;
};

export type Feedback360ReportListItem = {
  id: string;
  title: string;
  companyName: string;
  surveyName: string | null;
  reportDate: string | null;
  status: Feedback360ReportStatus;
  publishedAt: string | null;
  createdAt: string;
  projectId: string | null;
  organizationId: string | null;
  summary: Feedback360ReportSummary;
};

export type SaveFeedback360ReportInput = {
  result: FeedbackAnalysisResult;
  title: string;
  projectId?: string | null;
  organizationId?: string | null;
  userIds?: string[];
  status?: Feedback360ReportStatus;
};

type Feedback360ReportRow = {
  id: string;
  title: string;
  company_name: string;
  survey_name: string | null;
  report_date: string | null;
  status: Feedback360ReportStatus;
  published_at: string | null;
  created_at: string;
  project_id: string | null;
  organization_id: string | null;
  summary: Partial<Feedback360ReportSummary> | null;
  payload?: unknown;
};

const isMissingReportTableError = (error: unknown) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "").toLowerCase()
      : "";

  return (
    message.includes("feedback360_reports") ||
    message.includes("feedback360_report_access") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
};

const mapMissingTableError = (error: unknown) => {
  if (isMissingReportTableError(error)) {
    return new Error(
      "Reportová databázová migrácia nie je nasadená. Spustite supabase/feedback360_reports.sql."
    );
  }

  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  return new Error(message || "360 report sa nepodarilo načítať alebo uložiť.");
};

const normalizeNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeNullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeReportDate = (value: string | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const dateOnlyMatch = value.match(/^\d{4}-\d{2}-\d{2}$/);
    return dateOnlyMatch ? value : null;
  }
  return date.toISOString().slice(0, 10);
};

export const buildFeedback360ReportSummary = (
  result: FeedbackAnalysisResult
): Feedback360ReportSummary => {
  const feedback360 = result.feedback360;
  const companyReport = feedback360?.companyReport;
  const distribution = companyReport?.participantDistribution;
  const evaluatedPersons =
    feedback360?.individuals?.length ||
    companyReport?.participants?.length ||
    0;

  return {
    evaluatedPersons,
    participantsTotal: normalizeNullableNumber(distribution?.total),
    completedResponses: normalizeNullableNumber(distribution?.completed),
    successRate: normalizeNullableNumber(distribution?.successRate),
    competenciesCount: companyReport?.competencies?.length || 0,
    scaleMax: normalizeNumber(feedback360?.scaleMax, result.reportMetadata.scaleMax || 7),
  };
};

const mapReportRow = (row: Feedback360ReportRow): Feedback360ReportListItem => {
  const summary = row.summary || {};

  return {
    id: row.id,
    title: row.title,
    companyName: row.company_name,
    surveyName: row.survey_name,
    reportDate: row.report_date,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    projectId: row.project_id,
    organizationId: row.organization_id,
    summary: {
      evaluatedPersons: normalizeNumber(summary.evaluatedPersons),
      participantsTotal: normalizeNullableNumber(summary.participantsTotal),
      completedResponses: normalizeNullableNumber(summary.completedResponses),
      successRate: normalizeNullableNumber(summary.successRate),
      competenciesCount: normalizeNumber(summary.competenciesCount),
      scaleMax: normalizeNumber(summary.scaleMax, 7),
    },
  };
};

export const loadFeedback360Reports = async (): Promise<Feedback360ReportListItem[]> => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const { data, error } = await db
    .from("feedback360_reports")
    .select(
      "id, title, company_name, survey_name, report_date, status, published_at, created_at, project_id, organization_id, summary"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw mapMissingTableError(error);
  }

  return ((data || []) as Feedback360ReportRow[]).map(mapReportRow);
};

export const loadFeedback360ReportResult = async (
  reportId: string
): Promise<FeedbackAnalysisResult> => {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  const { data, error } = await db
    .from("feedback360_reports")
    .select("payload")
    .eq("id", reportId)
    .single();

  if (error) {
    throw mapMissingTableError(error);
  }

  const payload = (data as Feedback360ReportRow | null)?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Uložený 360 report má neplatný formát.");
  }

  const result = payload as FeedbackAnalysisResult;
  if (!result.mode) {
    result.mode = "360_FEEDBACK";
  }
  if (result.mode !== "360_FEEDBACK" || !result.feedback360) {
    throw new Error("Uložený report neobsahuje dáta modulu 360 SV.");
  }

  return result;
};

export const saveFeedback360Report = async ({
  result,
  title,
  projectId = null,
  organizationId = null,
  userIds = [],
  status = "published",
}: SaveFeedback360ReportInput): Promise<{ reportId: string }> => {
  if (result.mode !== "360_FEEDBACK" || !result.feedback360) {
    throw new Error("Uložiť je možné iba spracovaný report modulu 360 SV.");
  }

  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error("Zadajte názov reportu.");
  }

  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user.id || null;
  const now = new Date().toISOString();
  const feedback360 = result.feedback360;
  const companyName =
    feedback360.companyName || result.reportMetadata.company || "360 SV report";
  const surveyName = feedback360.surveyName || null;
  const reportDate = normalizeReportDate(result.reportMetadata.date);

  const { data, error } = await db
    .from("feedback360_reports")
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      title: normalizedTitle,
      company_name: companyName,
      survey_name: surveyName,
      report_date: reportDate,
      status,
      payload: result,
      summary: buildFeedback360ReportSummary(result),
      created_by: currentUserId,
      published_at: status === "published" ? now : null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw mapMissingTableError(error);
  }

  const reportId = String(data.id);
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length > 0) {
    const { error: accessError } = await db.from("feedback360_report_access").insert(
      uniqueUserIds.map((userId) => ({
        report_id: reportId,
        user_id: userId,
        granted_by: currentUserId,
      }))
    );

    if (accessError) {
      throw mapMissingTableError(accessError);
    }
  }

  return { reportId };
};
