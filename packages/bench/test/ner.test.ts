import { describe, expect, it } from "vitest";
import { createNerDetector } from "@maskit/ner";
import { runRealistic, runRealisticWith } from "../src/evaluate.js";
import { MODEL_ROOT, modelAvailable } from "../src/ner-report.js";

// Needs the model files: `pnpm --filter @maskit/ner fetch-model`. Skipped when they are absent.
describe.skipIf(!modelAvailable())("rules + on-device name model", () => {
  it("raises recall a lot while keeping precision, at standard and strict", async () => {
    const ner = await createNerDetector({ modelRoot: MODEL_ROOT });
    for (const level of ["standard", "strict"] as const) {
      const rules = runRealistic(level);
      const withNer = await runRealisticWith(level, [ner]);
      expect(withNer.overall.recall).toBeGreaterThanOrEqual(rules.overall.recall + 0.1);
      expect(withNer.overall.recall).toBeGreaterThanOrEqual(0.9);
      expect(withNer.overall.precision).toBeGreaterThanOrEqual(0.95);
    }
  }, 120_000);
});
