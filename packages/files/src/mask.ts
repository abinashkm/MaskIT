import { analyzeAsync, applyMask, type EntityType, type Finding } from "@maskit/core";
import type { FileMaskOptions, Tally } from "./types.js";

export function bump(tally: Tally, type: EntityType, n = 1): void {
  tally.set(type, (tally.get(type) ?? 0) + n);
}

export function findingsFor(text: string, options: FileMaskOptions): Promise<Finding[]> {
  return analyzeAsync(
    text,
    {
      level: options.level,
      entityTypes: options.entityTypes,
      customTerms: options.customTerms,
    },
    options.detectors ?? [],
  );
}

/** Masks one string with the shared session and records what was masked. */
export async function maskString(
  text: string,
  options: FileMaskOptions,
  tally: Tally,
): Promise<string> {
  const findings = await findingsFor(text, options);
  for (const f of findings) bump(tally, f.entityType);
  return applyMask(text, findings, options.session, options.style);
}

export function replacementFor(type: EntityType, value: string, options: FileMaskOptions): string {
  return options.style === "redact" ? "[REDACTED]" : options.session.tokenFor(type, value);
}
