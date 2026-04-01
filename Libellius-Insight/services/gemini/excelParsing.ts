import { CellValue, Workbook } from "exceljs";
import * as Papa from "papaparse";
import { MAX_EXCEL_FILE_BYTES, MAX_HEADER_LENGTH } from "./constants";
import {
  clampErrorMessage,
  clampString,
  ensureSpreadsheetLimits,
  normalizeHeaderName,
  readRawField,
  readStringField,
  toPlainCellValue,
} from "./shared";

const mapRowsToSimplifiedData = (rows: Record<string, unknown>[]) =>
  rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      question_id: readStringField(row, [
        "question_id",
        "Question_id",
        "question id",
        "Question ID",
        "id_otazky",
        "Id_otazky",
        "ID_otazky",
      ]),
      skupina: readStringField(row, ["skupina", "Skupina"]),
      survey_group: readStringField(row, [
        "survey_group",
        "Survey_group",
        "survey_skupina",
        "Survey_skupina",
        "survey group",
        "Survey group",
      ]),
      otazka: readStringField(row, ["otazka", "Otazka"]),
      hodnota: readRawField(row, ["hodnota", "Hodnota"], ""),
      text: readStringField(row, ["text_odpovede", "Text_odpovede"]),
      oblast: readStringField(row, ["oblast", "Oblast"], "Nezaradené"),
      typ: readStringField(row, ["typ", "Typ"]),
      kategoria_otazky: readStringField(
        row,
        ["kategoria_otazky", "Kategoria_otazky"],
        "Prierezova"
      ),
      nazov_firmy: readStringField(row, [
        "nazov_firmy",
        "Nazov_firmy",
        "názov_firmy",
        "Názov_firmy",
        "nazov firmy",
        "Nazov firmy",
        "Názov firmy",
        "firma",
        "Firma",
      ]),
      nazov_prieskumu: readStringField(row, [
        "nazov_prieskumu",
        "Nazov_prieskumu",
        "názov_prieskumu",
        "Názov_prieskumu",
        "nazov prieskumu",
        "Nazov prieskumu",
        "Názov prieskumu",
        "prieskum",
        "Prieskum",
      ]),
      tema_odpovede: readStringField(row, [
        "tema_odpovede",
        "Tema_odpovede",
        "label_temy",
        "Label_temy",
      ]),
      skala_hodnota: readRawField(
        row,
        ["skala_hodnota", "Skala_hodnota", "skala hodnota", "Skala hodnota"],
        null
      ),
    }));

export const parseExcelFile = async (file: File): Promise<string> => {
  if (!file || file.size <= 0) {
    throw new Error("Súbor je prázdny.");
  }
  if (file.size > MAX_EXCEL_FILE_BYTES) {
    throw new Error("Excel/CSV súbor je príliš veľký (max. 12 MB).");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (extension === "xls") {
    throw new Error("Formát .xls už nepodporujeme. Uložte súbor ako .xlsx alebo .csv.");
  }
  if (extension !== "xlsx" && extension !== "csv") {
    throw new Error("Podporované sú iba súbory .xlsx a .csv.");
  }

  try {
    let rows: Record<string, unknown>[] = [];

    if (extension === "csv") {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header: string) => clampString(header, MAX_HEADER_LENGTH),
      });

      if (parsed.errors.length > 0) {
        const firstError = parsed.errors[0];
        throw new Error(
          `CSV súbor sa nepodarilo načítať: ${clampErrorMessage(
            firstError?.message || "neznáma chyba"
          )}`
        );
      }

      const columnCount = parsed.meta.fields?.length || 0;
      const rowCount = parsed.data.length + (columnCount > 0 ? 1 : 0);
      ensureSpreadsheetLimits(rowCount, columnCount);
      rows = parsed.data;
    } else {
      const workbook = new Workbook();
      const data = await file.arrayBuffer();
      await workbook.xlsx.load(data);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new Error("Súbor neobsahuje žiadny hárok.");
      }

      const rowCount = sheet.actualRowCount;
      const columnCount = sheet.actualColumnCount;
      if (rowCount <= 0 || columnCount <= 0) {
        throw new Error("Prvý hárok neobsahuje čitateľné dáta.");
      }

      ensureSpreadsheetLimits(rowCount, columnCount);

      const usedHeaders = new Set<string>();
      const headerRow = sheet.getRow(1);
      const headers = Array.from({ length: columnCount }, (_, colIndex) =>
        normalizeHeaderName(
          toPlainCellValue(headerRow.getCell(colIndex + 1).value as CellValue),
          `column_${colIndex + 1}`,
          usedHeaders
        )
      );

      const parsedRows: Record<string, unknown>[] = [];
      for (let rowIndex = 2; rowIndex <= rowCount; rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        const parsedRow: Record<string, unknown> = {};
        let hasAnyValue = false;

        for (let colIndex = 1; colIndex <= columnCount; colIndex += 1) {
          const headerName = headers[colIndex - 1];
          if (!headerName) continue;

          const value = toPlainCellValue(row.getCell(colIndex).value as CellValue);
          if (value !== null && value !== "") {
            hasAnyValue = true;
          }
          parsedRow[headerName] = value;
        }

        if (hasAnyValue) {
          parsedRows.push(parsedRow);
        }
      }

      rows = parsedRows;
    }

    return JSON.stringify(mapRowsToSimplifiedData(rows));
  } catch (err) {
    throw err instanceof Error
      ? err
      : new Error("Nepodarilo sa prečítať Excel/CSV súbor.");
  }
};
