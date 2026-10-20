import type { Finding, Recognizer } from "../types.js";
import { ssnValid, validDayMonth } from "../validators.js";
import { finding, groupSpan, precededBy } from "./util.js";

const SSN_RE = /(?<![\d-])(\d{3})([- ])(\d{2})\2(\d{4})(?![\d-])/g;
const SSN_BARE_RE = /(?<!\d)(\d{3})(\d{2})(\d{4})(?!\d)/g;
const SSN_CONTEXT_RE = /\b(?:ssn|social security(?: number| no\.?)?|ss#)\b/i;

export const ssnRecognizer: Recognizer = {
  id: "us-ssn",
  entityTypes: ["US_SSN"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(SSN_RE)) {
      if (!ssnValid(m[1] ?? "", m[3] ?? "", m[4] ?? "")) continue;
      const boost = precededBy(text, m.index, SSN_CONTEXT_RE) ? 0.08 : 0;
      out.push(finding("US_SSN", m.index, m.index + m[0].length, 0.88 + boost, "us-ssn"));
    }
    for (const m of text.matchAll(SSN_BARE_RE)) {
      // Nine bare digits are only an SSN when the text says so.
      if (!precededBy(text, m.index, SSN_CONTEXT_RE)) continue;
      if (!ssnValid(m[1] ?? "", m[2] ?? "", m[3] ?? "")) continue;
      out.push(finding("US_SSN", m.index, m.index + m[0].length, 0.9, "us-ssn"));
    }
    return out;
  },
};

const MRN_RE =
  /\b(?:MRN|medical record(?: number| no\.?)?|patient id|chart (?:no\.?|number)|health plan(?: id| number)?|member id)\s*[:#=]?\s*([A-Z0-9][A-Z0-9-]{4,14})\b/dgi;

export const mrnRecognizer: Recognizer = {
  id: "mrn",
  entityTypes: ["MEDICAL_RECORD_NUMBER"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(MRN_RE)) {
      const span = groupSpan(m, 1);
      if (span && /\d/.test(m[1] ?? "")) {
        out.push(finding("MEDICAL_RECORD_NUMBER", span[0], span[1], 0.9, "mrn"));
      }
    }
    return out;
  },
};

const PASSPORT_RE = /\bpassport\s*(?:number|no\.?|num|#)?\s*[:#=]?\s*([A-Z0-9]{6,9})\b/dgi;

export const passportRecognizer: Recognizer = {
  id: "passport",
  entityTypes: ["PASSPORT"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(PASSPORT_RE)) {
      const span = groupSpan(m, 1);
      if (span && /\d/.test(m[1] ?? "")) {
        out.push(finding("PASSPORT", span[0], span[1], 0.85, "passport"));
      }
    }
    return out;
  },
};

const MONTHS =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const ORD = "(?:st|nd|rd|th)?";
const DATE_PATTERNS: RegExp[] = [
  // 2024-03-15, 2024/3/15
  /(?<![\d.])(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/g,
  // 03/15/2024, 15-03-2024, 3/5/24
  /(?<![\d.])(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})(?![\d/])/g,
  // March 15, 2024 / Mar 15th 2024
  new RegExp(`\\b${MONTHS}\\.?\\s+\\d{1,2}${ORD},?\\s+\\d{4}\\b`, "gi"),
  // 15 March 2024 / 15th of March, 2024
  new RegExp(`\\b\\d{1,2}${ORD}\\s+(?:of\\s+)?${MONTHS}\\.?,?\\s+\\d{4}\\b`, "gi"),
];

interface DateMatch {
  start: number;
  end: number;
}

function findDates(text: string): DateMatch[] {
  const found: DateMatch[] = [];
  DATE_PATTERNS.forEach((re, idx) => {
    for (const m of text.matchAll(re)) {
      if (idx === 0 && !validDayMonth(Number(m[2]), Number(m[3]))) continue;
      if (idx === 1) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        if (!validDayMonth(a, b) && !validDayMonth(b, a)) continue;
      }
      found.push({ start: m.index, end: m.index + m[0].length });
    }
  });
  return found;
}

export const dateRecognizer: Recognizer = {
  id: "date",
  entityTypes: ["DATE"],
  analyze(text) {
    return findDates(text).map((d) => finding("DATE", d.start, d.end, 0.7, "date"));
  },
};

const DOB_CONTEXT_RE =
  /\b(?:dob|d\.o\.b\.?|date of birth|birth ?date|birthday|born(?: on)?)(?![a-z])[\s:=-]*$/i;

export const dobRecognizer: Recognizer = {
  id: "date-of-birth",
  entityTypes: ["DATE_OF_BIRTH"],
  analyze(text) {
    const out: Finding[] = [];
    for (const d of findDates(text)) {
      if (precededBy(text, d.start, DOB_CONTEXT_RE, 30)) {
        out.push(finding("DATE_OF_BIRTH", d.start, d.end, 0.95, "date-of-birth"));
      }
    }
    return out;
  },
};

const AGE_RE = /\b(\d{2,3})[- ]years?[- ]old\b|\bage[d]?\s*[:=]?\s*(\d{2,3})\b/gi;

export const ageRecognizer: Recognizer = {
  id: "age-over-89",
  entityTypes: ["AGE_OVER_89"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(AGE_RE)) {
      const age = Number(m[1] ?? m[2]);
      if (age >= 90 && age <= 120) {
        out.push(finding("AGE_OVER_89", m.index, m.index + m[0].length, 0.9, "age-over-89"));
      }
    }
    return out;
  },
};
