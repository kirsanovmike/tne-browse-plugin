/**
 * IO офисных форматов: чтение .docx (Mammoth), чтение/запись .xlsx (ExcelJS).
 * Тяжёлые зависимости из npm, бандлятся Vite локально (без CDN). Не покрывается
 * Vitest (загрузка библиотек/реальные файлы) — ручная проверка в браузере, §6.
 */
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { normalizeDocxText } from "./docx-text";
import type { SheetData } from "./xlsx-format";

const MAX_SHEET_ROWS = 500;
const MAX_SHEET_COLS = 50;

/** .docx → плоский нормализованный текст (5.1). */
export async function readDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return normalizeDocxText(result.value || "");
}

/** Приводит значение ячейки ExcelJS к тексту (без markdown-экранирования). */
function cellToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as Array<{ text?: string }>).map((t) => t.text || "").join("").trim();
    }
    if (v.text != null) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
    if (v.formula != null) return "";
    if (v.sharedFormula != null) return "";
    if (v.error != null) return String(v.error);
  }
  return String(value).trim();
}

/** .xlsx → листы с матрицами значений (5.2). */
export async function readXlsx(file: File): Promise<SheetData[]> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const sheets: SheetData[] = [];
  wb.eachSheet((ws) => {
    const colCount = Math.min(ws.columnCount || 0, MAX_SHEET_COLS);
    const matrix: string[][] = [];
    let rows = 0;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows >= MAX_SHEET_ROWS) return;
      const cells: string[] = [];
      for (let c = 1; c <= colCount; c++) cells.push(cellToText(row.getCell(c).value));
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      matrix.push(cells);
      rows++;
    });
    sheets.push({ name: ws.name, matrix });
  });
  return sheets;
}

/** Матрица → буфер .xlsx одним листом (5.3). */
export async function matrixToWorkbookBuffer(matrix: string[][], sheetName: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  matrix.forEach((row) => ws.addRow(row));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
