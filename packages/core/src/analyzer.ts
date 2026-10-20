import { LEVEL_ENTITY_TYPES, LEVEL_MIN_CONFIDENCE } from "./levels.js";
import { customTermRecognizer, defaultRecognizers } from "./recognizers/index.js";
import { resolve } from "./resolver.js";
import type { AnalyzeOptions, Detector, EntityType, Finding, Recognizer } from "./types.js";

export function enabledEntityTypes(options: AnalyzeOptions): Set<EntityType> {
  const level = options.level ?? "standard";
  if (level === "custom") {
    if (!options.entityTypes) throw new Error('level "custom" requires `entityTypes`');
    return new Set(options.entityTypes);
  }
  return new Set(LEVEL_ENTITY_TYPES[level]);
}

interface Setup {
  enabled: Set<EntityType>;
  minConfidence: number;
  recognizers: Recognizer[];
}

function setup(options: AnalyzeOptions): Setup {
  const level = options.level ?? "standard";
  const enabled = enabledEntityTypes(options);
  const minConfidence = options.minConfidence ?? LEVEL_MIN_CONFIDENCE[level];
  const recognizers: Recognizer[] = [...defaultRecognizers, ...(options.recognizers ?? [])];
  if (options.customTerms && options.customTerms.length > 0) {
    enabled.add("CUSTOM");
    recognizers.push(customTermRecognizer(options.customTerms));
  }
  return { enabled, minConfidence, recognizers };
}

const keep = (f: Finding, s: Setup) =>
  s.enabled.has(f.entityType) && f.confidence >= s.minConfidence;

function candidatesFor(text: string, s: Setup): Finding[] {
  const candidates: Finding[] = [];
  for (const recognizer of s.recognizers) {
    // Skip recognizers that cannot produce any enabled type.
    if (!recognizer.entityTypes.some((t) => s.enabled.has(t))) continue;
    for (const f of recognizer.analyze(text)) if (keep(f, s)) candidates.push(f);
  }
  return candidates;
}

/**
 * Finds sensitive spans: runs recognizers, drops disabled types and low-confidence hits,
 * then removes overlaps. Pure function; never touches the network or storage.
 */
export function analyze(text: string, options: AnalyzeOptions = {}): Finding[] {
  const s = setup(options);
  return resolve(candidatesFor(text, s));
}

/**
 * Same as `analyze`, plus asynchronous detectors such as an on-device NER model. Their
 * findings go through the same level, confidence and overlap rules as the built-in ones.
 * A detector that fails is skipped, so the rule-based result is still returned.
 */
export async function analyzeAsync(
  text: string,
  options: AnalyzeOptions = {},
  detectors: Detector[] = [],
): Promise<Finding[]> {
  const s = setup(options);
  const candidates = candidatesFor(text, s);
  for (const detector of detectors) {
    if (!detector.entityTypes.some((t) => s.enabled.has(t))) continue;
    try {
      for (const f of await detector.detect(text)) if (keep(f, s)) candidates.push(f);
    } catch {
      // Keep going with the rules-only result rather than failing the whole mask.
    }
  }
  return resolve(candidates);
}
