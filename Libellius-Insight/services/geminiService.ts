import { analyzeDocument } from "./gemini/analyzeSatisfaction";
import { parseExcelFile } from "./gemini/excelParsing";
import { parseFeedback360Report } from "./feedback360Parser";
import { parseFeedback360Spreadsheet } from "./feedback360Spreadsheet";

export {
  analyzeDocument,
  parseExcelFile,
  parseFeedback360Report,
  parseFeedback360Spreadsheet,
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
  });
};
