import type { Finding, Recognizer } from "../types.js";
import { escapeRegExp, finding } from "./util.js";

/** User deny-list: every occurrence of each term (case-insensitive) becomes CUSTOM. */
export function customTermRecognizer(terms: string[]): Recognizer {
  const cleaned = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length > 0))];
  // Longest first so "Acme Corp" wins over "Acme".
  cleaned.sort((a, b) => b.length - a.length);
  const re = cleaned.length > 0 ? new RegExp(cleaned.map(escapeRegExp).join("|"), "gi") : undefined;
  return {
    id: "custom-terms",
    entityTypes: ["CUSTOM"],
    analyze(text) {
      const out: Finding[] = [];
      if (!re) return out;
      for (const m of text.matchAll(re)) {
        out.push(finding("CUSTOM", m.index, m.index + m[0].length, 1, "custom-terms"));
      }
      return out;
    },
  };
}
