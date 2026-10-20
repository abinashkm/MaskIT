import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ratio, runBenchmark, runRealistic } from "../src/evaluate.js";
import { renderMarkdown } from "../src/report.js";

// The benchmark is deterministic (fixed seed), so these floors act as a regression guard:
// a recognizer change that lowers accuracy on any entity type fails CI.
const report = runBenchmark();

describe("accuracy floors (synthetic set, strict level)", () => {
  it.each(report.perType.map((s) => [s.type, s] as const))("%s", (_type, s) => {
    expect(ratio(s.tp, s.tp + s.fp)).toBeGreaterThanOrEqual(0.95);
    expect(ratio(s.tp, s.tp + s.fn)).toBeGreaterThanOrEqual(0.95);
    expect(ratio(s.covered, s.total)).toBeGreaterThanOrEqual(0.99);
  });

  it("overall precision and recall", () => {
    expect(report.overall.precision).toBeGreaterThanOrEqual(0.97);
    expect(report.overall.recall).toBeGreaterThanOrEqual(0.97);
  });

  it("covers every entity type the generators know about", () => {
    expect(report.perType.length).toBeGreaterThanOrEqual(19);
  });
});

describe("false positives on ordinary text", () => {
  it("flags nothing at basic and almost nothing at standard and strict", () => {
    const rate = (level: string) => {
      const n = report.negatives.find((x) => x.level === level);
      return ratio(n?.flagged ?? 0, n?.lines ?? 1);
    };
    expect(rate("basic")).toBe(0);
    expect(rate("standard")).toBeLessThanOrEqual(0.02);
    expect(rate("strict")).toBeLessThanOrEqual(0.02);
  });
});

describe("docs/BENCHMARKS.md", () => {
  it("is up to date; run `pnpm --filter @maskit/bench bench` and commit the result", () => {
    const file = new URL("../../../docs/BENCHMARKS.md", import.meta.url);
    const onDisk = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    expect(onDisk).toBe(renderMarkdown(report));
  });
});

describe("hand-written realistic set (rules only)", () => {
  // Floors sit a little under the measured values so a real regression fails but noise does not.
  it("keeps precision high and recall above the measured floor at the default level", () => {
    const r = runRealistic("standard");
    expect(r.overall.precision).toBeGreaterThanOrEqual(0.97);
    expect(r.overall.recall).toBeGreaterThanOrEqual(0.78);
  });
  it("keeps strict-level numbers above their floors", () => {
    const r = runRealistic("strict");
    expect(r.overall.precision).toBeGreaterThanOrEqual(0.97);
    expect(r.overall.recall).toBeGreaterThanOrEqual(0.74);
  });
  it("finds every structured identifier in the set", () => {
    const r = runRealistic("strict");
    for (const type of [
      "EMAIL",
      "PHONE",
      "CREDIT_CARD",
      "IBAN",
      "US_SSN",
      "SECRET",
      "URL_CREDENTIALS",
      "IP_ADDRESS",
    ]) {
      const s = r.perType.find((x) => x.type === type);
      expect(s?.fn, type).toBe(0);
      expect(s?.fp, type).toBe(0);
    }
  });
});
