import { strFromU8, strToU8 } from "fflate";
import { maskCsv } from "./csv.js";
import { maskDocx } from "./docx.js";
import { maskString } from "./mask.js";
import { maskXlsx } from "./xlsx.js";
import type { FileMaskOptions, MaskedFile, Tally } from "./types.js";

export type { FileMaskOptions, MaskedFile, Tally } from "./types.js";
export { hintForHeader, maskCsv, parseCsv, stringifyCsv } from "./csv.js";
export { maskDocx } from "./docx.js";
export { maskXlsx } from "./xlsx.js";
export { maskString } from "./mask.js";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const SUPPORTED_EXTENSIONS = ["txt", "md", "log", "json", "csv", "tsv", "docx", "xlsx"];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function baseOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? name : name.slice(0, dot);
}

const PREVIEW_CHARS = 4000;

/**
 * Masks a file entirely in memory. PDF text extraction needs browser-only libraries, so
 * callers extract the text first and pass it in as a ".txt" file (see packages/web).
 */
export async function maskFile(
  name: string,
  bytes: Uint8Array,
  options: FileMaskOptions,
): Promise<MaskedFile> {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`File is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
  }
  const ext = extensionOf(name);
  const tally: Tally = new Map();
  const base = baseOf(name);

  if (ext === "docx") {
    const { data, warnings } = await maskDocx(bytes, options, tally);
    return {
      outputName: `${base}.masked.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      data,
      tally,
      warnings,
    };
  }

  if (ext === "xlsx") {
    const { data, warnings } = await maskXlsx(bytes, options, tally);
    return {
      outputName: `${base}.masked.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      data,
      tally,
      warnings,
    };
  }

  if (ext === "csv" || ext === "tsv") {
    const { text, warnings } = await maskCsv(strFromU8(bytes), options, tally);
    return {
      outputName: `${base}.masked.${ext}`,
      mimeType: ext === "csv" ? "text/csv" : "text/tab-separated-values",
      data: strToU8(text),
      tally,
      warnings,
      preview: text.slice(0, PREVIEW_CHARS),
    };
  }

  if (["txt", "md", "log", "json"].includes(ext)) {
    const text = await maskString(strFromU8(bytes), options, tally);
    return {
      outputName: `${base}.masked.${ext}`,
      mimeType: ext === "json" ? "application/json" : "text/plain",
      data: strToU8(text),
      tally,
      warnings: [],
      preview: text.slice(0, PREVIEW_CHARS),
    };
  }

  throw new Error(
    `Unsupported file type ".${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}, pdf`,
  );
}
