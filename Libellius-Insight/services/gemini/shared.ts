import { CellValue } from "exceljs";
import {
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_EXCEL_CELLS,
  MAX_EXCEL_COLUMNS,
  MAX_EXCEL_ROWS,
  MAX_HEADER_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
} from "./constants";

export const hasOwn = (obj: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const clampString = (
  value: unknown,
  maxLength = MAX_TEXT_FIELD_LENGTH
) => String(value ?? "").trim().slice(0, maxLength);

export const clampErrorMessage = (value: unknown) =>
  clampString(value, MAX_ERROR_MESSAGE_LENGTH);

export const ensureSpreadsheetLimits = (rowCount: number, columnCount: number) => {
  const safeRows = Math.max(0, rowCount);
  const safeColumns = Math.max(0, columnCount);
  const cellCount = safeRows * safeColumns;

  if (safeRows > MAX_EXCEL_ROWS) {
    throw new Error(
      `Excel/CSV obsahuje príliš veľa riadkov (${safeRows}). Maximum je ${MAX_EXCEL_ROWS}.`
    );
  }
  if (safeColumns > MAX_EXCEL_COLUMNS) {
    throw new Error(
      `Excel/CSV obsahuje príliš veľa stĺpcov (${safeColumns}). Maximum je ${MAX_EXCEL_COLUMNS}.`
    );
  }
  if (cellCount > MAX_EXCEL_CELLS) {
    throw new Error(
      `Excel/CSV obsahuje príliš veľa buniek (${cellCount}). Maximum je ${MAX_EXCEL_CELLS}.`
    );
  }
};

export const normalizeHeaderName = (
  value: unknown,
  fallback: string,
  used: Set<string>
) => {
  const base = clampString(value, MAX_HEADER_LENGTH) || fallback;
  let candidate = base;
  let suffix = 2;

  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}_${suffix++}`;
  }

  used.add(candidate.toLowerCase());
  return candidate;
};

export const toPlainCellValue = (value: CellValue): unknown => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return clampString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) {
      return toPlainCellValue(value.result as CellValue);
    }
    if ("text" in value && typeof value.text === "string") {
      return clampString(value.text);
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return clampString(value.richText.map((chunk) => chunk?.text ?? "").join(""));
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return clampString(value.hyperlink);
    }
    if ("error" in value && typeof value.error === "string") {
      return clampString(value.error);
    }
  }

  return clampString(value);
};

export const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const isExcludedTheme = (theme: string) => {
  const normalized = normalize(String(theme || ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");
  return compact === "bezodpovede" || compact === "bezodpovedi";
};

export const readStringField = (
  row: Record<string, unknown>,
  keys: string[],
  fallback = ""
) => {
  for (const key of keys) {
    if (!hasOwn(row, key)) continue;
    const value = row[key];
    if (value === undefined || value === null) continue;
    const text = clampString(value);
    if (text) return text;
  }
  return fallback;
};

export const readRawField = (
  row: Record<string, unknown>,
  keys: string[],
  fallback: unknown = ""
) => {
  for (const key of keys) {
    if (!hasOwn(row, key)) continue;
    const value = row[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string") return clampString(value);
    return value;
  }
  return fallback;
};

export const warnInDev = (...args: unknown[]) => {
  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    console.warn(...args);
  }
};

export const inferMetaFromFileName = (sourceFileName: string) => {
  const fileName = String(sourceFileName || "").trim();
  if (!fileName) return { clientName: "", surveyName: "" };

  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  const base = withoutExt.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  let candidate = base.replace(/\s+insighthub\b.*$/i, "").trim();
  if (!candidate) candidate = base;

  candidate = candidate
    .replace(/\s+v\d+\b.*$/i, "")
    .replace(/\s+survey\s*group\b.*$/i, "")
    .trim();

  const clientName = candidate.length >= 3 ? candidate : "";
  const surveyName = clientName
    ? `Prieskum spokojnosti zamestnancov spoločnosti ${clientName}`
    : "";

  return { clientName, surveyName };
};

export const toSafeIdToken = (value: string) => {
  const normalized = normalize(String(value || ""));
  const token = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return token || "group";
};
