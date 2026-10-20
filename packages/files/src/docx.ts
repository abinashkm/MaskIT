import { strFromU8, strToU8, zipSync, type Zippable } from "fflate";
import {
  decodeXml,
  encodeXml,
  maskRuns,
  stripAppProperties,
  stripCoreProperties,
  unzipSafely,
  WORD_TEXT,
} from "./ooxml.js";
import type { FileMaskOptions, Tally } from "./types.js";

export { decodeXml, encodeXml };

const TEXT_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;

/** Reviewer names are personal data too. */
function anonymizeAuthors(xml: string): string {
  return xml.replace(/\bw:(author|initials)="[^"]*"/g, (_m, attr: string) =>
    attr === "author" ? 'w:author="Author"' : 'w:initials=""',
  );
}

export interface DocxResult {
  data: Uint8Array;
  warnings: string[];
}

export async function maskDocx(
  bytes: Uint8Array,
  options: FileMaskOptions,
  tally: Tally,
): Promise<DocxResult> {
  const files = unzipSafely(bytes);
  if (!files["word/document.xml"]) throw new Error("Not a valid .docx file (no word/document.xml)");

  const warnings: string[] = [];
  const outFiles: Zippable = {};
  for (const [name, content] of Object.entries(files)) {
    if (TEXT_PARTS.test(name)) {
      const xml = await maskRuns(strFromU8(content), WORD_TEXT, options, tally);
      outFiles[name] = strToU8(anonymizeAuthors(xml));
    } else if (name === "docProps/core.xml") {
      outFiles[name] = strToU8(stripCoreProperties(strFromU8(content)));
    } else if (name === "docProps/app.xml") {
      outFiles[name] = strToU8(stripAppProperties(strFromU8(content)));
    } else {
      outFiles[name] = content;
    }
  }
  if (Object.keys(files).some((n) => n.startsWith("word/media/"))) {
    warnings.push("Images inside the document are not scanned and were kept as they are.");
  }
  return { data: zipSync(outFiles), warnings };
}
