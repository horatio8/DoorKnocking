// Parse an uploaded CSV or XLSX buffer into a normalised row shape that
// downstream code can map onto PLATFORM_FIELDS without caring about the
// source format.
//
// Server-only: uses `papaparse` (CSV) and `xlsx` (Excel). Both run fine
// in Node but aren't edge-safe.

import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFile {
  header: string[];                       // normalised column names, in file order
  rows: Array<Record<string, string>>;    // row values keyed by normalised header
  rowCount: number;                       // length of rows
}

export type SupportedMime =
  | "text/csv"
  | "application/vnd.ms-excel"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function detectFormat(
  filename: string,
  mimeType: string | null,
): "csv" | "xlsx" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  if (mimeType === "text/csv") return "csv";
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  return null;
}

function normaliseHeader(raw: string): string {
  return raw.trim();
}

export function parseCsv(buffer: Buffer): ParsedFile {
  const text = buffer.toString("utf-8");
  const out = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h: string) => normaliseHeader(h),
  });
  if (out.errors.length > 0) {
    // Papa flags row-level parse issues but still hands back data. Surface
    // the first critical error only.
    const fatal = out.errors.find((e) => e.type === "Delimiter" || e.type === "Quotes");
    if (fatal) throw new Error(`CSV parse failed at row ${fatal.row ?? "?"}: ${fatal.message}`);
  }
  const header = (out.meta.fields ?? []).map(normaliseHeader);
  const rows = (out.data ?? []).filter((r) => Object.values(r).some((v) => v !== "" && v != null));
  return { header, rows, rowCount: rows.length };
}

export function parseXlsx(buffer: Buffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("XLSX file has no sheets");
  const sheet = wb.Sheets[sheetName];
  const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: "",
  });
  if (rowsRaw.length === 0) return { header: [], rows: [], rowCount: 0 };
  const header = Object.keys(rowsRaw[0]).map(normaliseHeader);
  const rows = rowsRaw.map((r) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      o[normaliseHeader(k)] = v == null ? "" : String(v);
    }
    return o;
  });
  return { header, rows, rowCount: rows.length };
}

export function parseFile(buffer: Buffer, format: "csv" | "xlsx"): ParsedFile {
  return format === "csv" ? parseCsv(buffer) : parseXlsx(buffer);
}
