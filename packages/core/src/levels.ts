import type { EntityType, MaskLevel } from "./types.js";

const BASIC: EntityType[] = [
  "EMAIL",
  "PHONE",
  "US_SSN",
  "CREDIT_CARD",
  "IBAN",
  "BANK_ACCOUNT",
  "SECRET",
  "PASSWORD",
  "URL_CREDENTIALS",
];

const STANDARD: EntityType[] = [
  ...BASIC,
  "PERSON",
  "US_ADDRESS",
  "DATE_OF_BIRTH",
  "MEDICAL_RECORD_NUMBER",
  "PASSPORT",
  "IP_ADDRESS",
  "MAC_ADDRESS",
  "GPS_COORDINATES",
];

// Approximates HIPAA Safe Harbor: all dates, small locations, organizations, ages over 89.
const STRICT: EntityType[] = [...STANDARD, "DATE", "AGE_OVER_89", "ORGANIZATION", "LOCATION"];

export const LEVEL_ENTITY_TYPES: Record<Exclude<MaskLevel, "custom">, EntityType[]> = {
  basic: BASIC,
  standard: STANDARD,
  strict: STRICT,
};

/** Lower levels demand higher confidence, so they stay precise; strict favors recall. */
export const LEVEL_MIN_CONFIDENCE: Record<MaskLevel, number> = {
  basic: 0.8,
  standard: 0.5,
  strict: 0.3,
  custom: 0.5,
};
