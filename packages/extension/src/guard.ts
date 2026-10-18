import { analyze, type Finding } from "@maskit/core";
import type { Settings } from "./settings";

/** Findings that should interrupt a send, or an empty list when the prompt can go through. */
export function evaluate(text: string, settings: Settings): Finding[] {
  if (!settings.enabled || text.trim() === "") return [];
  return analyze(text, { level: settings.level, customTerms: settings.customTerms });
}

/**
 * One-shot permission to send without masking. It expires so a forgotten "send anyway"
 * can never let a later, different prompt through unchecked.
 */
export class SendBypass {
  private grantedAt: number | undefined;

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = 10_000,
  ) {}

  allowNext(): void {
    this.grantedAt = this.now();
  }

  /** Returns true (and uses up the permission) if a valid grant exists. */
  consume(): boolean {
    const granted = this.grantedAt;
    this.grantedAt = undefined;
    return granted !== undefined && this.now() - granted <= this.ttlMs;
  }
}
