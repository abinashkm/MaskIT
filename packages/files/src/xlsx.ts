import { strFromU8, strToU8, zipSync, type Zippable } from "fflate";
import {
  EXCEL_TEXT,
  maskRuns,
  stripAppProperties,
  stripCoreProperties,
  unzipSafely,
} from "./ooxml.js";
import type { FileMaskOptions, Tally } from "./types.js";

// Text cells live in the shared string table; a few producers write inline strings instead.
const TEXT_PARTS = /^xl\/(sharedStrings|comments\d*|worksheets\/sheet\d+)\.xml$/;
const NOTE_PARTS = /^xl\/(threadedComments\/threadedComment\d+|persons\/person)\.xml$/;

/** Comment and note authors are personal data too. */
function anonymizeAuthors(xml: string): string {
  return xml
    .replace(/(<author>)[^<]*(<\/author>)/g, "$1Author$2")
    .replace(/(\bdisplayName=")[^"]*(")/g, "$1Author$2");
}

export interface XlsxResult {
  data: Uint8Array;
  warnings: string[];
}

/**
 * Masks the text of an Excel workbook, keeping formatting and formulas. Numbers stored as
 * numeric cells (a phone number typed as a number, for example) are not text and are not
 * scanned; the warnings tell the user so.
 */
export async function maskXlsx(
  bytes: Uint8Array,
  options: FileMaskOptions,
  tally: Tally,
): Promise<XlsxResult> {
  const files = unzipSafely(bytes);
  if (!files["xl/workbook.xml"]) throw new Error("Not a valid .xlsx file (no xl/workbook.xml)");

  const outFiles: Zippable = {};
  for (const [name, content] of Object.entries(files)) {
    if (TEXT_PARTS.test(name)) {
      const xml = await maskRuns(strFromU8(content), EXCEL_TEXT, options, tally);
      outFiles[name] = strToU8(anonymizeAuthors(xml));
    } else if (NOTE_PARTS.test(name)) {
      outFiles[name] = strToU8(anonymizeAuthors(strFromU8(content)));
    } else if (name === "docProps/core.xml") {
      outFiles[name] = strToU8(stripCoreProperties(strFromU8(content)));
    } else if (name === "docProps/app.xml") {
      outFiles[name] = strToU8(stripAppProperties(strFromU8(content)));
    } else {
      outFiles[name] = content;
    }
  }

  const warnings = [
    "Numbers stored as numeric cells, sheet names, formulas and chart or image contents are not scanned. Check them yourself.",
  ];
  if (Object.keys(files).some((n) => n.startsWith("xl/media/") || n.startsWith("xl/charts/"))) {
    warnings.push("Images or charts inside the workbook were kept as they are.");
  }
  return { data: zipSync(outFiles), warnings };
}
