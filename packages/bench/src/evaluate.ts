import { analyze, type EntityType, type Finding, type MaskLevel } from "@maskit/core";
import { GENERATORS, HARD_GENERATORS, negatives, type Case, type Gold } from "./generators.js";
import { Rng } from "./rng.js";

export const SEED = 20261019;
export const PER_TYPE = 200;
export const NEGATIVE_COUNT = 450;

export interface TypeScore {
  type: EntityType;
  tp: number;
  fp: number;
  fn: number;
  /** Gold values covered by any finding, regardless of the label. This is the privacy-relevant number. */
  covered: number;
  total: number;
}

const iou = (a: { start: number; end: number }, b: { start: number; end: number }) => {
  const inter = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const union = a.end - a.start + (b.end - b.start) - inter;
  return union === 0 ? 0 : inter / union;
};

const coverage = (g: Gold, f: Finding) =>
  Math.max(0, Math.min(g.end, f.end) - Math.max(g.start, f.start)) / (g.end - g.start);

export function buildPositiveCases(): Map<EntityType, Case[]> {
  const rng = new Rng(SEED);
  const out = new Map<EntityType, Case[]>();
  for (const [type, make] of Object.entries(GENERATORS) as [EntityType, (r: Rng) => Case][]) {
    out.set(
      type,
      Array.from({ length: PER_TYPE }, () => make(rng)),
    );
  }
  return out;
}

export function buildHardCases(): Map<string, { type: EntityType; cases: Case[] }> {
  const rng = new Rng(SEED + 1);
  const out = new Map<string, { type: EntityType; cases: Case[] }>();
  for (const [name, { type, make }] of Object.entries(HARD_GENERATORS)) {
    out.set(name, { type, cases: Array.from({ length: 100 }, () => make(rng)) });
  }
  return out;
}

export function scoreCases(cases: Case[], level: MaskLevel): Map<EntityType, TypeScore> {
  const scores = new Map<EntityType, TypeScore>();
  const get = (type: EntityType): TypeScore => {
    let s = scores.get(type);
    if (!s) {
      s = { type, tp: 0, fp: 0, fn: 0, covered: 0, total: 0 };
      scores.set(type, s);
    }
    return s;
  };
  for (const c of cases) {
    const findings = analyze(c.text, { level });
    const usedGold = new Set<number>();
    for (const f of findings) {
      const idx = c.gold.findIndex(
        (g, i) => !usedGold.has(i) && g.type === f.entityType && iou(g, f) >= 0.5,
      );
      if (idx >= 0) {
        usedGold.add(idx);
        get(f.entityType).tp++;
      } else {
        get(f.entityType).fp++;
      }
    }
    c.gold.forEach((g, i) => {
      const s = get(g.type);
      s.total++;
      if (!usedGold.has(i)) s.fn++;
      if (findings.some((f) => coverage(g, f) >= 0.5)) s.covered++;
    });
  }
  return scores;
}

export interface Report {
  perType: TypeScore[];
  overall: { precision: number; recall: number; f1: number; covered: number };
  hard: {
    name: string;
    type: EntityType;
    total: number;
    typedHits: number;
    covered: number;
    coveredStandard: number;
  }[];
  negatives: { level: MaskLevel; lines: number; flagged: number; examples: string[] }[];
}

export const ratio = (n: number, d: number) => (d === 0 ? 1 : n / d);

export function runBenchmark(): Report {
  const positives = buildPositiveCases();
  const merged = new Map<EntityType, TypeScore>();
  for (const [type, cases] of positives) {
    // Each type's cases are scored at strict so every entity type is enabled.
    for (const [t, s] of scoreCases(cases, "strict")) {
      const m = merged.get(t) ?? { type: t, tp: 0, fp: 0, fn: 0, covered: 0, total: 0 };
      m.tp += s.tp;
      m.fp += s.fp;
      m.fn += s.fn;
      m.covered += s.covered;
      m.total += s.total;
      merged.set(t, m);
    }
    void type;
  }
  const perType = [...merged.values()].sort((a, b) => a.type.localeCompare(b.type));
  const sum = perType.reduce(
    (acc, s) => ({
      tp: acc.tp + s.tp,
      fp: acc.fp + s.fp,
      fn: acc.fn + s.fn,
      covered: acc.covered + s.covered,
      total: acc.total + s.total,
    }),
    { tp: 0, fp: 0, fn: 0, covered: 0, total: 0 },
  );
  const precision = ratio(sum.tp, sum.tp + sum.fp);
  const recall = ratio(sum.tp, sum.tp + sum.fn);

  const hard = [...buildHardCases()].map(([name, { type, cases }]) => {
    const empty = { tp: 0, covered: 0, total: cases.length };
    const strict = scoreCases(cases, "strict").get(type) ?? empty;
    const standard = scoreCases(cases, "standard").get(type) ?? empty;
    return {
      name,
      type,
      total: strict.total,
      typedHits: strict.tp,
      covered: strict.covered,
      coveredStandard: standard.covered,
    };
  });

  const lines = negatives(new Rng(SEED + 2), NEGATIVE_COUNT);
  const negs = (["basic", "standard", "strict"] as MaskLevel[]).map((level) => {
    const flagged = lines.filter((l) => analyze(l, { level }).length > 0);
    return { level, lines: lines.length, flagged: flagged.length, examples: flagged.slice(0, 3) };
  });

  return {
    perType,
    overall: {
      precision,
      recall,
      f1: ratio(2 * precision * recall, precision + recall),
      covered: ratio(sum.covered, sum.total),
    },
    hard,
    negatives: negs,
  };
}
