import { unzipSync } from "fflate";
import { bump, findingsFor, replacementFor } from "./mask.js";
import type { FileMaskOptions, Tally } from "./types.js";

/** Office files are zip archives; refuse ones that unpack to an unreasonable size. */
export const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

export function unzipSafely(bytes: Uint8Array): ReturnType<typeof unzipSync> {
  let total = 0;
  return unzipSync(bytes, {
    filter(file) {
      total += file.originalSize;
      if (total > MAX_UNCOMPRESSED_BYTES) throw new Error("File expands to an unsafe size");
      return true;
    },
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x")) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body] ?? whole;
  });
}

export function encodeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Run {
  start: number; // offset of the element in the xml string
  end: number;
  tag: string;
  attrs: string;
  text: string; // decoded
}

/**
 * How one kind of Office part stores text. `nodeRe` must match text elements with the tag name
 * in group 1, attributes in group 2 and text in group 3, and ALSO match the closing tag of
 * whatever groups text together (a paragraph, a shared-string item): those matches have no
 * group 1. Text is scanned per group because a sentence is usually split over several runs.
 */
export interface PartKind {
  nodeRe: RegExp;
  /** Element prefix when writing a run back, e.g. "w:" for Word, "" for Excel. */
  prefix: string;
}

export const WORD_TEXT: PartKind = {
  // <w:t> is text; <w:delText> is a tracked deletion that still holds the original words.
  nodeRe: /<w:(t|delText)(\s[^>]*)?>([^<]*)<\/w:\1>|<\/w:p>/g,
  prefix: "w:",
};

export const EXCEL_TEXT: PartKind = {
  // Shared strings (<si>) and inline strings (<is>) hold the cell text in <t> runs.
  nodeRe: /<(t)(\s[^>]*)?>([^<]*)<\/t>|<\/si>|<\/is>/g,
  prefix: "",
};

export async function maskRuns(
  xml: string,
  kind: PartKind,
  options: FileMaskOptions,
  tally: Tally,
): Promise<string> {
  // Split the part into groups of runs, mask each group (the detector may be asynchronous),
  // then stitch the XML back together.
  const groups: Run[][] = [];
  let group: Run[] = [];
  for (const m of xml.matchAll(kind.nodeRe)) {
    if (m[1] === undefined) {
      if (group.length > 0) groups.push(group);
      group = [];
    } else {
      group.push({
        start: m.index,
        end: m.index + m[0].length,
        tag: m[1],
        attrs: m[2] ?? "",
        text: decodeXml(m[3] ?? ""),
      });
    }
  }
  if (group.length > 0) groups.push(group);

  let out = "";
  let cursor = 0;
  for (const runs of groups) {
    const joined = runs.map((r) => r.text).join("");
    const findings = await findingsFor(joined, options);
    if (findings.length === 0) continue;
    for (const f of findings) bump(tally, f.entityType);
    let offset = 0;
    for (const run of runs) {
      const runStart = offset;
      const runEnd = offset + run.text.length;
      offset = runEnd;
      let result = "";
      let pos = runStart;
      for (const f of findings) {
        if (f.end <= runStart || f.start >= runEnd) continue;
        if (pos < f.start) result += joined.slice(pos, f.start);
        // The replacement goes into the run where the finding begins.
        if (f.start >= runStart) {
          result += replacementFor(f.entityType, joined.slice(f.start, f.end), options);
        }
        pos = Math.max(pos, Math.min(f.end, runEnd));
      }
      result += joined.slice(pos, runEnd);
      const attrs = /xml:space=/.test(run.attrs) ? run.attrs : `${run.attrs} xml:space="preserve"`;
      out += xml.slice(cursor, run.start);
      out += `<${kind.prefix}${run.tag}${attrs}>${encodeXml(result)}</${kind.prefix}${run.tag}>`;
      cursor = run.end;
    }
  }
  return out + xml.slice(cursor);
}

const CORE_PROPS = [
  "dc:creator",
  "cp:lastModifiedBy",
  "dc:title",
  "dc:subject",
  "dc:description",
  "cp:keywords",
];

/** Author, title and similar fields in docProps/core.xml identify people and projects. */
export function stripCoreProperties(xml: string): string {
  let result = xml;
  for (const tag of CORE_PROPS) {
    result = result.replace(new RegExp(`(<${tag}(?:\\s[^>]*)?>)[^<]*(</${tag}>)`, "g"), "$1$2");
  }
  return result;
}

/** Company and manager in docProps/app.xml. */
export function stripAppProperties(xml: string): string {
  return xml.replace(/(<(Company|Manager)>)[^<]*(<\/\2>)/g, "$1$3");
}
