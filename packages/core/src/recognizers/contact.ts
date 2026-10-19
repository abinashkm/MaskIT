import type { Finding, Recognizer } from "../types.js";
import { ipv4Valid, luhn } from "../validators.js";
import { finding, groupSpan, precededBy } from "./util.js";

const EMAIL_RE =
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;

export const emailRecognizer: Recognizer = {
  id: "email",
  entityTypes: ["EMAIL"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(EMAIL_RE)) {
      out.push(finding("EMAIL", m.index, m.index + m[0].length, 0.95, "email"));
    }
    return out;
  },
};

const PHONE_CANDIDATE_RE = /(?<![\w+])\+?\(?\d[\d\s().-]{7,18}\d(?!\w|-\w)/g;
const PHONE_US_RE = /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
const PHONE_CONTEXT_RE = /\b(?:phone|tel|telephone|mobile|cell|fax|call|whatsapp|contact)\b/i;
// Numbers labeled like this are identifiers, not phones (unless a phone word is also nearby).
const NOT_PHONE_CONTEXT_RE =
  /\b(?:order|invoice|tracking|ticket|ref|reference|sku|serial|case|account|acct)\b[\s#:.-]*(?:no\.?|number|num)?[\s#:.-]*$/i;
const MAC_LIKE_RE = /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const DATE_LIKE_RE = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/;

export const phoneRecognizer: Recognizer = {
  id: "phone",
  entityTypes: ["PHONE"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(PHONE_CANDIDATE_RE)) {
      const raw = m[0];
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) continue;
      if (DATE_LIKE_RE.test(raw.trim())) continue;
      if (ipv4Valid(raw.trim()) || MAC_LIKE_RE.test(raw.trim())) continue; // network addresses
      if (digits.length >= 13 && luhn(digits)) continue; // card numbers are handled elsewhere
      const hasSeparators = /[\s().-]/.test(raw);
      let confidence: number;
      if (raw.startsWith("+")) confidence = 0.9;
      else if (PHONE_US_RE.test(raw) && hasSeparators) confidence = 0.85;
      else if (hasSeparators) confidence = 0.5;
      else confidence = 0.35; // bare digit run: only trustworthy with context
      if (confidence < 0.8) {
        if (precededBy(text, m.index, PHONE_CONTEXT_RE)) confidence += 0.4;
        else if (precededBy(text, m.index, NOT_PHONE_CONTEXT_RE)) continue;
      }
      out.push(finding("PHONE", m.index, m.index + raw.length, confidence, "phone"));
    }
    return out;
  },
};

const STREET_SUFFIX =
  "(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Highway|Hwy)";
const ADDRESS_RE = new RegExp(
  `\\b\\d{1,6}\\s+(?:[A-Z][A-Za-z]*\\.?\\s+){1,4}${STREET_SUFFIX}\\b\\.?(?:,?\\s+(?:Apt|Suite|Ste|Unit|#)\\s*[\\w-]+)?`,
  "g",
);

export const addressRecognizer: Recognizer = {
  id: "us-address",
  entityTypes: ["US_ADDRESS"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(ADDRESS_RE)) {
      out.push(finding("US_ADDRESS", m.index, m.index + m[0].length, 0.75, "us-address"));
    }
    return out;
  },
};

// Names are detected from labels/titles until the NER layer exists (planned).
const PERSON_RE =
  /\b(?:Patient(?: Name)?|Full Name|Name|Client|Customer|Employee|Contact|Attn|Dear|Mr|Mrs|Ms|Miss|Dr|Prof)\b\.?\s*[:-]?\s*([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,3})/dg;
const NOT_A_NAME = new Set([
  "Customer",
  "Client",
  "Sir",
  "Madam",
  "Team",
  "All",
  "Support",
  "Service",
  "Name",
  "Number",
  "The",
  "Of",
  "Id",
]);

// Capitalized words that usually begin the next clause or field rather than continue a name.
const NAME_TERMINATORS = new Set([
  "Thanks",
  "Thank",
  "Please",
  "That",
  "This",
  "Let",
  "And",
  "Is",
  "Was",
  "Has",
  "Had",
  "Will",
  "Would",
  "Phone",
  "Email",
  "Tel",
  "Mobile",
  "Address",
  "Date",
  "Dob",
  "DOB",
  "MRN",
  "SSN",
  "Age",
  "Sex",
  "Gender",
  "Regards",
  "Best",
  "Sincerely",
  "Hi",
  "Hello",
]);

export const personRecognizer: Recognizer = {
  id: "person-label",
  entityTypes: ["PERSON"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(PERSON_RE)) {
      const span = groupSpan(m, 1);
      if (!span) continue;
      // Drop leading stop words ("Dear Customer"), then cut at the first word that clearly
      // starts something else ("Smith Phone", "Jane Doe Thanks").
      const words = (m[1] ?? "").split(/\s+/);
      while (words.length > 0 && NOT_A_NAME.has(words[0] ?? "")) words.shift();
      const stopAt = words.findIndex((w, i) => i > 0 && NAME_TERMINATORS.has(w));
      if (stopAt > 0) words.length = stopAt;
      if (words.length === 0) continue;
      const value = words.join(" ");
      const start = span[0] + (m[1] ?? "").indexOf(value);
      out.push(finding("PERSON", start, start + value.length, 0.7, "person-label"));
    }
    return out;
  },
};
