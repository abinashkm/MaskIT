import type { EntityType, Finding } from "../types.js";

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** True when `re` matches the text just before `start` on the same line (context keywords). */
export function precededBy(text: string, start: number, re: RegExp, window = 40): boolean {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const from = Math.max(lineStart, start - window);
  return re.test(text.slice(from, start));
}

/** Offsets of capture group `g` (needs the `d` regex flag). */
export function groupSpan(m: RegExpMatchArray, g: number): [number, number] | undefined {
  const span = m.indices?.[g];
  return span ? [span[0], span[1]] : undefined;
}

export function finding(
  entityType: EntityType,
  start: number,
  end: number,
  confidence: number,
  recognizerId: string,
): Finding {
  return { entityType, start, end, confidence: clamp01(confidence), recognizerId };
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
