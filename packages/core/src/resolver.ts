import type { EntityType, Finding } from "./types.js";

/**
 * Higher number wins when two findings overlap. Specific, validated types beat generic ones
 * (a Luhn-valid card beats a "phone-looking" digit run; a date of birth beats a plain date).
 */
export const ENTITY_PRIORITY: Record<EntityType, number> = {
  CUSTOM: 100,
  URL_CREDENTIALS: 96,
  SECRET: 95,
  PASSWORD: 90,
  CREDIT_CARD: 88,
  US_SSN: 86,
  IBAN: 84,
  BANK_ACCOUNT: 82,
  EMAIL: 80,
  MEDICAL_RECORD_NUMBER: 78,
  PASSPORT: 76,
  DATE_OF_BIRTH: 74,
  PHONE: 70,
  GPS_COORDINATES: 66,
  IP_ADDRESS: 64,
  MAC_ADDRESS: 62,
  US_ADDRESS: 60,
  PERSON: 50,
  AGE_OVER_89: 45,
  DATE: 40,
  ORGANIZATION: 30,
  LOCATION: 20,
};

/**
 * Removes overlapping findings. Winner order: entity priority, then confidence, then
 * longer span, then earlier start. Result is sorted by start offset.
 */
export function resolve(findings: Finding[]): Finding[] {
  const ranked = [...findings].sort(
    (a, b) =>
      ENTITY_PRIORITY[b.entityType] - ENTITY_PRIORITY[a.entityType] ||
      b.confidence - a.confidence ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start,
  );
  const accepted: Finding[] = [];
  for (const f of ranked) {
    if (f.end <= f.start) continue;
    if (!accepted.some((a) => f.start < a.end && a.start < f.end)) accepted.push(f);
  }
  return accepted.sort((a, b) => a.start - b.start);
}
