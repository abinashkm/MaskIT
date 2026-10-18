import { LEVEL_ENTITY_TYPES, LEVEL_MIN_CONFIDENCE } from "./levels.js";
import { customTermRecognizer, defaultRecognizers } from "./recognizers/index.js";
import { resolve } from "./resolver.js";
import type { AnalyzeOptions, EntityType, Finding, Recognizer } from "./types.js";

export function enabledEntityTypes(options: AnalyzeOptions): Set<EntityType> {
  const level = options.level ?? "standard";
  if (level === "custom") {
    if (!options.entityTypes) throw new Error('level "custom" requires `entityTypes`');
    return new Set(options.entityTypes);
  }
  return new Set(LEVEL_ENTITY_TYPES[level]);
}

/**
 * Finds sensitive spans: runs recognizers, drops disabled types and low-confidence hits,
 * then removes overlaps. Pure function; never touches the network or storage.
 */
export function analyze(text: string, options: AnalyzeOptions = {}): Finding[] {
  const level = options.level ?? "standard";
  const enabled = enabledEntityTypes(options);
  const minConfidence = options.minConfidence ?? LEVEL_MIN_CONFIDENCE[level];

  const recognizers: Recognizer[] = [...defaultRecognizers, ...(options.recognizers ?? [])];
  if (options.customTerms && options.customTerms.length > 0) {
    enabled.add("CUSTOM");
    recognizers.push(customTermRecognizer(options.customTerms));
  }

  const candidates: Finding[] = [];
  for (const recognizer of recognizers) {
    // Skip recognizers that cannot produce any enabled type.
    if (!recognizer.entityTypes.some((t) => enabled.has(t))) continue;
    for (const f of recognizer.analyze(text)) {
      if (enabled.has(f.entityType) && f.confidence >= minConfidence) candidates.push(f);
    }
  }
  return resolve(candidates);
}
