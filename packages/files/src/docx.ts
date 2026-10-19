import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { bump, findingsFor, replacementFor } from "./mask.js";
import type { FileMaskOptions, Tally } from "./types.js";

const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // zip-bomb guard
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;

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
  tag: string; // "t" or "delText"
  attrs: string;
  text: string; // decoded
}

// Text lives in <w:t> (and <w:delText> for tracked deletions, which still hold the original text).
// A sentence is usually split over several runs, so we match per paragraph, not per run.
const NODE_RE = /<w:(t|delText)(\s[^>]*)?>([^<]*)<\/w:\1>|<\/w:p>/g;

function maskPart(xml: string, options: FileMaskOptions, tally: Tally): string {
  let out = "";
  let cursor = 0;
  let group: Run[] = [];

  const flush = () => {
    if (group.length === 0) return;
    const joined = group.map((r) => r.text).join("");
    const findings = findingsFor(joined, options);
    if (findings.length > 0) {
      for (const f of findings) bump(tally, f.entityType);
      let offset = 0;
      for (const run of group) {
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
        const attrs = /xml:space=/.test(run.attrs)
          ? run.attrs
          : `${run.attrs} xml:space="preserve"`;
        out += xml.slice(cursor, run.start);
        out += `<w:${run.tag}${attrs}>${encodeXml(result)}</w:${run.tag}>`;
        cursor = run.end;
      }
    }
    group = [];
  };

  for (const m of xml.matchAll(NODE_RE)) {
    if (m[0] === "</w:p>") {
      flush();
    } else {
      group.push({
        start: m.index,
        end: m.index + m[0].length,
        tag: m[1] as string,
        attrs: m[2] ?? "",
        text: decodeXml(m[3] ?? ""),
      });
    }
  }
  flush();
  return out + xml.slice(cursor);
}

/** Reviewer names are personal data too. */
function anonymizeAuthors(xml: string): string {
  return xml.replace(/\bw:(author|initials)="[^"]*"/g, (_m, attr: string) =>
    attr === "author" ? 'w:author="Author"' : 'w:initials=""',
  );
}

const CORE_PROPS = [
  "dc:creator",
  "cp:lastModifiedBy",
  "dc:title",
  "dc:subject",
  "dc:description",
  "cp:keywords",
];

function stripProperties(xml: string): string {
  let result = xml;
  for (const tag of CORE_PROPS) {
    result = result.replace(new RegExp(`(<${tag}(?:\\s[^>]*)?>)[^<]*(</${tag}>)`, "g"), "$1$2");
  }
  return result;
}

function stripAppProperties(xml: string): string {
  return xml.replace(/(<(Company|Manager)>)[^<]*(<\/\2>)/g, "$1$3");
}

export interface DocxResult {
  data: Uint8Array;
  warnings: string[];
}

export function maskDocx(bytes: Uint8Array, options: FileMaskOptions, tally: Tally): DocxResult {
  let total = 0;
  const files = unzipSync(bytes, {
    filter(file) {
      total += file.originalSize;
      if (total > MAX_UNCOMPRESSED_BYTES) throw new Error("File expands to an unsafe size");
      return true;
    },
  });
  if (!files["word/document.xml"]) throw new Error("Not a valid .docx file (no word/document.xml)");

  const warnings: string[] = [];
  const outFiles: Zippable = {};
  for (const [name, content] of Object.entries(files)) {
    if (TEXT_PARTS.test(name)) {
      const xml = anonymizeAuthors(maskPart(strFromU8(content), options, tally));
      outFiles[name] = strToU8(xml);
    } else if (name === "docProps/core.xml") {
      outFiles[name] = strToU8(stripProperties(strFromU8(content)));
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
