import { describe, expect, it } from "vitest";
import { chunkText, plausible, tokensToFindings, type ModelToken } from "../src/align.js";

const t = (entity: string, word: string, score = 0.99): ModelToken => ({ entity, word, score });
const spans = (text: string, tokens: ModelToken[]) =>
  tokensToFindings(text, tokens).map((f) => [f.entityType, text.slice(f.start, f.end)]);

describe("tokensToFindings", () => {
  it("joins word pieces of one entity and maps them to PERSON, ORGANIZATION, LOCATION", () => {
    const text = "Tom Becker of Northwind Traders in Springfield";
    expect(
      spans(text, [
        t("B-PER", "Tom"),
        t("I-PER", "Becker"),
        t("B-ORG", "North"),
        t("B-ORG", "##wind", 0.7),
        t("I-ORG", "Trade"),
        t("I-ORG", "##rs"),
        t("B-LOC", "Springfield"),
      ]),
    ).toEqual([
      ["PERSON", "Tom Becker"],
      ["ORGANIZATION", "Northwind Traders"],
      ["LOCATION", "Springfield"],
    ]);
  });
  it("keeps two adjacent people apart when the second begins a new entity", () => {
    const text = "Tom Anna";
    expect(spans(text, [t("B-PER", "Tom"), t("B-PER", "Anna")])).toEqual([
      ["PERSON", "Tom"],
      ["PERSON", "Anna"],
    ]);
  });
  it("applies offsets and ignores MISC and unplaceable pieces", () => {
    const f = tokensToFindings(
      "xx Jane French",
      [t("B-PER", "Jane"), t("B-MISC", "French"), t("B-PER", "???")],
      100,
    );
    expect(f.map((x) => [x.start, x.end])).toEqual([[103, 107]]);
  });
  it("drops low scores", () => {
    expect(spans("Jane", [t("B-PER", "Jane", 0.3)])).toEqual([]);
  });
  it("averages scores into the confidence", () => {
    const [f] = tokensToFindings("Jane Doe", [t("B-PER", "Jane", 0.9), t("I-PER", "Doe", 0.7)]);
    expect(f?.confidence).toBeCloseTo(0.8);
  });
  it("calls a hospital an organization even when the model says place", () => {
    const text = "St. Mary's Hospital";
    expect(
      spans(text, [
        t("B-LOC", "St"),
        t("B-LOC", "."),
        t("I-LOC", "Mary"),
        t("I-LOC", "'"),
        t("I-LOC", "s"),
        t("I-LOC", "Hospital"),
      ]),
    ).toEqual([["ORGANIZATION", "St. Mary's Hospital"]]);
  });
});

describe("plausible", () => {
  it("rejects greetings, abbreviations, lowercase words and dotted initials", () => {
    expect(plausible("PERSON", "Hi")).toBe(false);
    expect(plausible("PERSON", "Regards")).toBe(false);
    expect(plausible("LOCATION", "CA")).toBe(false);
    expect(plausible("ORGANIZATION", "fono")).toBe(false);
    expect(plausible("LOCATION", "D.O.B.")).toBe(false);
  });
  it("rejects sentence-opening verbs the model takes for names", () => {
    expect(plausible("PERSON", "Call")).toBe(false);
    expect(plausible("PERSON", "Contact")).toBe(false);
    expect(plausible("PERSON", "Callum")).toBe(true); // a real name that merely starts the same way
  });
  it("accepts normal names, places and organizations", () => {
    expect(plausible("PERSON", "Priya")).toBe(true);
    expect(plausible("PERSON", "Al-Sayed")).toBe(true);
    expect(plausible("LOCATION", "San Francisco")).toBe(true);
    expect(plausible("ORGANIZATION", "IBM")).toBe(false); // short all-caps organizations are not masked
    expect(plausible("ORGANIZATION", "Initech")).toBe(true);
  });
});

describe("chunkText", () => {
  it("keeps offsets and covers the whole text", () => {
    const text = "word ".repeat(1000);
    const chunks = chunkText(text, 500);
    expect(chunks.map((c) => c.text).join("")).toBe(text);
    let pos = 0;
    for (const c of chunks) {
      expect(c.offset).toBe(pos);
      expect(c.text.length).toBeLessThanOrEqual(500);
      pos += c.text.length;
    }
  });
  it("returns nothing for empty text", () => {
    expect(chunkText("")).toEqual([]);
  });
});
