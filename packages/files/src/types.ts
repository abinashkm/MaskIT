import type { EntityType, MaskLevel, MaskSession, MaskStyle } from "@maskit/core";

export interface FileMaskOptions {
  level?: MaskLevel;
  entityTypes?: EntityType[];
  customTerms?: string[];
  style?: MaskStyle;
  /** Share with the rest of the app so replies can be restored with the same mapping. */
  session: MaskSession;
}

/** How many items of each type were masked. */
export type Tally = Map<EntityType, number>;

export interface MaskedFile {
  /** Name to offer for the download. */
  outputName: string;
  mimeType: string;
  data: Uint8Array;
  tally: Tally;
  /** Things the user must know, e.g. "images are not scanned". */
  warnings: string[];
  /** Plain-text view of the result for on-screen preview (text-like formats only). */
  preview?: string;
}
