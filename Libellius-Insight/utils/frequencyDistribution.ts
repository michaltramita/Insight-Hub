import { FrequencyDistribution } from "../types";

export type FrequencyDistributionKey = keyof FrequencyDistribution;

const NORMALIZED_NA_VALUES = new Set(["N/A", "NA", "N.A.", "N A", "N-A"]);

const normalizeQuestionTextForKey = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeTeamForKey = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const createEmptyFrequencyDistribution = (): FrequencyDistribution => ({
  na: 0,
  one: 0,
  two: 0,
  three: 0,
  four: 0,
  five: 0,
});

export const normalizeScaleDistributionKey = (
  rawScaleValue: unknown
): FrequencyDistributionKey | null => {
  if (rawScaleValue === undefined || rawScaleValue === null) return null;

  if (typeof rawScaleValue === "number" && Number.isFinite(rawScaleValue)) {
    if (rawScaleValue === 1) return "one";
    if (rawScaleValue === 2) return "two";
    if (rawScaleValue === 3) return "three";
    if (rawScaleValue === 4) return "four";
    if (rawScaleValue === 5) return "five";
    return null;
  }

  const rawText = String(rawScaleValue).trim();
  if (!rawText) return null;

  const upper = rawText.toUpperCase().replace(/\s+/g, " ");
  if (NORMALIZED_NA_VALUES.has(upper)) return "na";

  const numericText = upper.replace(",", ".");
  const numericValue = Number(numericText);
  if (Number.isFinite(numericValue)) {
    if (numericValue === 1) return "one";
    if (numericValue === 2) return "two";
    if (numericValue === 3) return "three";
    if (numericValue === 4) return "four";
    if (numericValue === 5) return "five";
  }

  return null;
};

export const buildQuestionDistributionKey = (
  questionId: string,
  questionText: string
) => {
  const safeQuestionId = String(questionId || "").trim();
  if (safeQuestionId) return `id:${safeQuestionId}`;
  return `text:${normalizeQuestionTextForKey(questionText)}`;
};

export const buildQuestionTeamDistributionKey = (
  questionDistributionKey: string,
  teamName: string
) => `${questionDistributionKey}::${normalizeTeamForKey(teamName)}`;
