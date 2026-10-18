export type EntityType =
  | "EMAIL"
  | "PHONE"
  | "US_SSN"
  | "CREDIT_CARD"
  | "IBAN"
  | "BANK_ACCOUNT"
  | "IP_ADDRESS"
  | "MAC_ADDRESS"
  | "GPS_COORDINATES"
  | "SECRET"
  | "PASSWORD"
  | "URL_CREDENTIALS"
  | "PERSON"
  | "US_ADDRESS"
  | "DATE_OF_BIRTH"
  | "DATE"
  | "AGE_OVER_89"
  | "MEDICAL_RECORD_NUMBER"
  | "PASSPORT"
  | "ORGANIZATION" // reserved for the NER layer (planned)
  | "LOCATION" // reserved for the NER layer (planned)
  | "CUSTOM";

export interface Finding {
  entityType: EntityType;
  /** Inclusive start offset in the analyzed text. */
  start: number;
  /** Exclusive end offset. */
  end: number;
  /** 0..1, how sure the recognizer is. */
  confidence: number;
  recognizerId: string;
}

export interface Recognizer {
  id: string;
  entityTypes: EntityType[];
  analyze(text: string): Finding[];
}

export type MaskLevel = "basic" | "standard" | "strict" | "custom";

/** token: reversible `[EMAIL_1]`; redact: irreversible `[REDACTED]`. */
export type MaskStyle = "token" | "redact";

export interface AnalyzeOptions {
  level?: MaskLevel;
  /** Required for level "custom": exactly which entity types to mask. */
  entityTypes?: EntityType[];
  /** Overrides the level's default minimum confidence. */
  minConfidence?: number;
  /** User deny-list: every occurrence is masked as CUSTOM (case-insensitive). */
  customTerms?: string[];
  /** Extra recognizers appended to the built-in set. */
  recognizers?: Recognizer[];
}
