import type { Finding, Recognizer } from "../types.js";
import { finding, groupSpan } from "./util.js";

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g, // GitHub tokens
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, // Slack tokens
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\b[sr]k_(?:live|test)_[0-9a-zA-Z]{16,}\b/g, // Stripe keys
  /\bsk-[A-Za-z0-9_-]{20,}\b/g, // OpenAI / Anthropic style keys
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export const secretRecognizer: Recognizer = {
  id: "secret",
  entityTypes: ["SECRET"],
  analyze(text) {
    const out: Finding[] = [];
    for (const re of SECRET_PATTERNS) {
      for (const m of text.matchAll(re)) {
        out.push(finding("SECRET", m.index, m.index + m[0].length, 0.97, "secret"));
      }
    }
    return out;
  },
};

const KEYWORD_VALUE_RE =
  /\b(password|passwd|pwd|passphrase|secret|api[_ -]?key|access[_ -]?token|auth[_ -]?token|token)\b["']?\s*(?:is\s+|[:=]\s*)["']?([^\s"',;]{4,})/dgi;

export const credentialRecognizer: Recognizer = {
  id: "credential-keyword",
  entityTypes: ["PASSWORD", "SECRET"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(KEYWORD_VALUE_RE)) {
      let span = groupSpan(m, 2);
      if (!span) continue;
      // In a URL query string "&" separates parameters; in a password it is just a character.
      if (/[?&]/.test(text[m.index - 1] ?? "")) {
        const cut = (m[2] ?? "").indexOf("&");
        if (cut >= 4) span = [span[0], span[0] + cut];
        else if (cut >= 0) continue;
      }
      const isPassword = /^pass|^pwd/i.test(m[1] ?? "");
      out.push(
        finding(isPassword ? "PASSWORD" : "SECRET", span[0], span[1], 0.85, "credential-keyword"),
      );
    }
    return out;
  },
};

const URL_BASIC_AUTH_RE = /\b[a-z][a-z0-9+.-]*:\/\/([^\s/:@]+:[^\s/@]+)@/dgi;
const URL_QUERY_SECRET_RE =
  /[?&](?:token|access_token|api_?key|apikey|key|sig|signature|password|auth|secret)=([^&\s#]+)/dgi;

export const urlCredentialRecognizer: Recognizer = {
  id: "url-credentials",
  entityTypes: ["URL_CREDENTIALS"],
  analyze(text) {
    const out: Finding[] = [];
    for (const re of [URL_BASIC_AUTH_RE, URL_QUERY_SECRET_RE]) {
      for (const m of text.matchAll(re)) {
        const span = groupSpan(m, 1);
        if (span) out.push(finding("URL_CREDENTIALS", span[0], span[1], 0.9, "url-credentials"));
      }
    }
    return out;
  },
};
