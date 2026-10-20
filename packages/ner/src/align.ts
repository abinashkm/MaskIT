import type { EntityType, Finding } from "@maskit/core";

/** One token as returned by a token-classification model (offsets are not provided). */
export interface ModelToken {
  entity: string; // e.g. "B-PER", "I-ORG"
  score: number;
  word: string; // word piece, "##" marks a continuation
}

const TYPE_FOR: Record<string, EntityType | undefined> = {
  PER: "PERSON",
  PERSON: "PERSON",
  ORG: "ORGANIZATION",
  LOC: "LOCATION",
  // MISC (nationalities, events, products) is deliberately ignored.
};

export const NER_ID = "ner";

/**
 * Turns word pieces into character spans by finding each piece, in order, in the text, then
 * joins pieces of the same entity. A piece starting with B- begins a new entity unless it
 * touches the previous piece of the same type (e.g. "St" + "." + "Mary").
 */
export function tokensToFindings(
  text: string,
  tokens: readonly ModelToken[],
  offset = 0,
  minScore = 0.5,
): Finding[] {
  interface Span {
    type: EntityType;
    start: number;
    end: number;
    scores: number[];
  }
  const spans: Span[] = [];
  let cursor = 0;
  let current: Span | undefined;

  for (const token of tokens) {
    const match = /^([BI])-(.+)$/.exec(token.entity);
    const type = match ? TYPE_FOR[match[2] as string] : undefined;
    const piece = token.word.replace(/^##/, "");
    const at = piece === "" ? -1 : text.indexOf(piece, cursor);
    if (at < 0) {
      current = undefined; // could not place this piece (e.g. unknown character); do not guess
      continue;
    }
    const end = at + piece.length;
    const gap = at - cursor;
    cursor = end;
    if (!type || !match) {
      current = undefined;
      continue;
    }
    const isBegin = match[1] === "B";
    const touches = current !== undefined && current.type === type && at === current.end;
    const continues =
      current !== undefined &&
      current.type === type &&
      (touches || (!isBegin && /^\s*$/.test(text.slice(current.end, at)) && gap <= 3));
    if (continues && current) {
      current.end = end;
      current.scores.push(token.score);
    } else {
      current = { type, start: at, end, scores: [token.score] };
      spans.push(current);
    }
  }

  return spans
    .map((s) => ({ ...s, score: s.scores.reduce((a, b) => a + b, 0) / s.scores.length }))
    .filter((s) => s.score >= minScore && plausible(s.type, text.slice(s.start, s.end)))
    .map((s) => ({
      entityType: refineType(s.type, text.slice(s.start, s.end)),
      start: offset + s.start,
      end: offset + s.end,
      confidence: Math.min(0.99, s.score),
      recognizerId: NER_ID,
    }));
}

// Words models often tag as names at the start of a sentence or field.
const NOT_ENTITIES = new Set([
  "hi",
  "hello",
  "hey",
  "dear",
  "regards",
  "thanks",
  "thank",
  "best",
  "sincerely",
  "cheers",
  "please",
  "claim",
  "iban",
  "dob",
  "sex",
  "age",
  "name",
  "email",
  "phone",
  "tel",
  "mr",
  "mrs",
  "ms",
  "dr",
  "sir",
  "madam",
  "team",
  "customer",
  "agent",
  "client",
  "patient",
  // Sentence-opening verbs that models often tag as the start of a name ("Call Elena Gonzalez").
  "call",
  "email",
  "contact",
  "ask",
  "tell",
  "send",
  "meet",
  "see",
  "visit",
  "text",
  "reach",
  "note",
  "cc",
  "bcc",
  "fwd",
]);

/** Cheap sanity checks on a model hit; the model alone is noisy on short, informal text. */
export function plausible(type: EntityType, value: string): boolean {
  const v = value.trim();
  if (v.length < 2) return false;
  if (!/^\p{Lu}/u.test(v)) return false; // names and organizations start with a capital
  if (NOT_ENTITIES.has(v.toLowerCase())) return false;
  if (/^(?:\p{L}\.){2,}$/u.test(v)) return false; // "D.O.B."
  // Short all-caps hits are state codes or abbreviations, not identifying places or companies.
  if (type !== "PERSON" && /^[\p{Lu}]{1,3}$/u.test(v)) return false;
  return true;
}

const ORG_WORDS =
  /\b(?:Hospital|Clinic|Medical|Center|Centre|Inc|LLC|Ltd|Corp|Company|Co|University|College|Institute|Bank|Group|Holdings|Partners|Pharmacy|Laboratories|Labs)\.?$/;

/** A model often calls "St. Mary's Hospital" a place; by its last word it is an organization. */
function refineType(type: EntityType, value: string): EntityType {
  return type === "LOCATION" && ORG_WORDS.test(value.trim()) ? "ORGANIZATION" : type;
}

/** Splits long text into model-sized pieces at line or sentence breaks, keeping offsets. */
export function chunkText(text: string, maxChars = 1200): { text: string; offset: number }[] {
  const chunks: { text: string; offset: number }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxChars);
    if (end < text.length) {
      const window = text.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf(" "),
      );
      if (breakAt > maxChars / 2) end = start + breakAt + 1;
    }
    chunks.push({ text: text.slice(start, end), offset: start });
    start = end;
  }
  return chunks;
}
