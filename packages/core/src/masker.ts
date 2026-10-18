import { analyze } from "./analyzer.js";
import type { AnalyzeOptions, EntityType, Finding, MaskStyle } from "./types.js";

/**
 * Holds the token <-> original value mapping. The mapping is sensitive: keep it in memory
 * (or encrypted session storage), never log it, and never hand it to the page.
 */
export class MaskSession {
  private readonly tokenToValue = new Map<string, string>();
  private readonly keyToToken = new Map<string, string>();
  private readonly counters = new Map<EntityType, number>();

  /** Same value of the same type always gets the same token within a session. */
  tokenFor(entityType: EntityType, value: string): string {
    const key = `${entityType}\u0000${normalize(entityType, value)}`;
    const existing = this.keyToToken.get(key);
    if (existing) return existing;
    const n = (this.counters.get(entityType) ?? 0) + 1;
    this.counters.set(entityType, n);
    const token = `[${entityType}_${n}]`;
    this.keyToToken.set(key, token);
    this.tokenToValue.set(token, value);
    return token;
  }

  valueFor(token: string): string | undefined {
    return this.tokenToValue.get(token);
  }

  get size(): number {
    return this.tokenToValue.size;
  }

  clear(): void {
    this.tokenToValue.clear();
    this.keyToToken.clear();
    this.counters.clear();
  }

  /** Plain snapshot for the caller to display or encrypt; treat as sensitive. */
  toJSON(): Record<string, string> {
    return Object.fromEntries(this.tokenToValue);
  }
}

function normalize(entityType: EntityType, value: string): string {
  const v = value.trim();
  switch (entityType) {
    case "EMAIL":
    case "PERSON":
    case "CUSTOM":
    case "ORGANIZATION":
    case "LOCATION":
      return v.toLowerCase().replace(/\s+/g, " ");
    case "PHONE":
    case "CREDIT_CARD":
    case "US_SSN":
    case "BANK_ACCOUNT":
      return v.replace(/\D/g, "");
    case "IBAN":
      return v.replace(/\s/g, "").toUpperCase();
    default:
      return v;
  }
}

export interface MaskOptions extends AnalyzeOptions {
  style?: MaskStyle;
  /** Reuse across calls so repeated values share tokens (e.g. a whole chat). */
  session?: MaskSession;
}

export interface MaskResult {
  masked: string;
  findings: Finding[];
  session: MaskSession;
}

/** Applies chosen findings to the text. Lets a UI mask only the findings a user approved. */
export function applyMask(
  text: string,
  findings: Finding[],
  session: MaskSession,
  style: MaskStyle = "token",
): string {
  const ordered = [...findings].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const f of ordered) {
    if (f.start < cursor) continue; // defensive: ignore overlaps
    out += text.slice(cursor, f.start);
    out +=
      style === "token" ? session.tokenFor(f.entityType, text.slice(f.start, f.end)) : "[REDACTED]";
    cursor = f.end;
  }
  return out + text.slice(cursor);
}

export function maskText(text: string, options: MaskOptions = {}): MaskResult {
  const session = options.session ?? new MaskSession();
  const findings = analyze(text, options);
  return { masked: applyMask(text, findings, session, options.style), findings, session };
}

const TOKEN_RE = /\[([A-Z_]+_\d+)\]/g;

/** Puts original values back into text (e.g. an AI reply). Unknown tokens are left as-is. */
export function restoreText(text: string, session: MaskSession): string {
  return text.replace(TOKEN_RE, (token) => session.valueFor(token) ?? token);
}
