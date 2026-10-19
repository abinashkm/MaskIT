import { analyze, applyMask, type EntityType, type Finding } from "@maskit/core";
import type { FileMaskOptions, Tally } from "./types.js";

export function bump(tally: Tally, type: EntityType, n = 1): void {
  tally.set(type, (tally.get(type) ?? 0) + n);
}

export function findingsFor(text: string, options: FileMaskOptions): Finding[] {
  return analyze(text, {
    level: options.level,
    entityTypes: options.entityTypes,
    customTerms: options.customTerms,
  });
}

/** Masks one string with the shared session and records what was masked. */
export function maskString(text: string, options: FileMaskOptions, tally: Tally): string {
  const findings = findingsFor(text, options);
  for (const f of findings) bump(tally, f.entityType);
  return applyMask(text, findings, options.session, options.style);
}

export function replacementFor(type: EntityType, value: string, options: FileMaskOptions): string {
  return options.style === "redact" ? "[REDACTED]" : options.session.tokenFor(type, value);
}
