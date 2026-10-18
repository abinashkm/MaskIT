import type { Finding, Recognizer } from "../types.js";
import { abaValid, ibanValid, luhn } from "../validators.js";
import { finding, groupSpan } from "./util.js";

const CARD_RE = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;

export const creditCardRecognizer: Recognizer = {
  id: "credit-card",
  entityTypes: ["CREDIT_CARD"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(CARD_RE)) {
      const digits = m[0].replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 19 || !luhn(digits)) continue;
      out.push(finding("CREDIT_CARD", m.index, m.index + m[0].length, 0.95, "credit-card"));
    }
    return out;
  },
};

const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g;

export const ibanRecognizer: Recognizer = {
  id: "iban",
  entityTypes: ["IBAN"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(IBAN_RE)) {
      if (!ibanValid(m[0])) continue;
      out.push(finding("IBAN", m.index, m.index + m[0].length, 0.95, "iban"));
    }
    return out;
  },
};

const ACCOUNT_RE =
  /\b(?:account|acct|a\/c)\s*(?:number|no\.?|num|#)?\s*(?:is|[:=#])?\s*(\d{6,17})\b/dgi;
const ROUTING_RE = /\brouting\s*(?:number|no\.?|num|#)?\s*(?:is|[:=#])?\s*(\d{9})\b/dgi;

export const bankAccountRecognizer: Recognizer = {
  id: "bank-account",
  entityTypes: ["BANK_ACCOUNT"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(ACCOUNT_RE)) {
      const span = groupSpan(m, 1);
      if (span) out.push(finding("BANK_ACCOUNT", span[0], span[1], 0.85, "bank-account"));
    }
    for (const m of text.matchAll(ROUTING_RE)) {
      const span = groupSpan(m, 1);
      if (span && abaValid(m[1] ?? "")) {
        out.push(finding("BANK_ACCOUNT", span[0], span[1], 0.9, "bank-account"));
      }
    }
    return out;
  },
};
