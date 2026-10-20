import { describe, expect, it } from "vitest";
import { analyze, maskText, MaskSession, resolve, restoreText } from "../src/index.js";

const SAMPLE =
  "Patient: Jane Doe, DOB: 03/15/1980, email jane@example.com, phone (415) 555-2671, " +
  "card 4111 1111 1111 1111, seen on March 20, 2024.";

describe("levels", () => {
  it("basic masks only high-confidence identifiers", () => {
    const types = analyze(SAMPLE, { level: "basic" }).map((f) => f.entityType);
    expect(types).toEqual(["EMAIL", "PHONE", "CREDIT_CARD"]);
  });
  it("standard adds names and date of birth but not plain dates", () => {
    const types = analyze(SAMPLE, { level: "standard" }).map((f) => f.entityType);
    expect(types).toEqual(["PERSON", "DATE_OF_BIRTH", "EMAIL", "PHONE", "CREDIT_CARD"]);
  });
  it("strict also masks plain dates", () => {
    const types = analyze(SAMPLE, { level: "strict" }).map((f) => f.entityType);
    expect(types).toContain("DATE");
  });
  it("custom uses exactly the chosen types", () => {
    const types = analyze(SAMPLE, { level: "custom", entityTypes: ["EMAIL"] }).map(
      (f) => f.entityType,
    );
    expect(types).toEqual(["EMAIL"]);
  });
  it("custom without entityTypes throws", () => {
    expect(() => analyze(SAMPLE, { level: "custom" })).toThrow();
  });
});

describe("custom terms", () => {
  it("masks deny-list terms case-insensitively, longest first", () => {
    const r = maskText("Project Falcon Heavy and falcon.", {
      level: "basic",
      customTerms: ["Falcon", "Falcon Heavy"],
    });
    expect(r.masked).toBe("Project [CUSTOM_1] and [CUSTOM_2].");
  });
});

describe("masking", () => {
  it("replaces values with tokens and never leaks originals", () => {
    const { masked } = maskText(SAMPLE, { level: "standard" });
    expect(masked).not.toMatch(/jane|4111|555-2671|1980/i);
    expect(masked).toContain("[EMAIL_1]");
    expect(masked).toContain("March 20, 2024"); // plain date kept at standard
  });
  it("reuses a token for the same value, even with different formatting", () => {
    const r = maskText("a@x.com then A@X.COM then (415) 555-2671 and 415-555-2671 phone", {
      level: "standard",
    });
    expect(r.masked).toBe("[EMAIL_1] then [EMAIL_1] then [PHONE_1] and [PHONE_1] phone");
  });
  it("keeps tokens stable across calls with a shared session", () => {
    const session = new MaskSession();
    maskText("x a@x.com", { level: "basic", session });
    const second = maskText("y b@x.com and a@x.com", { level: "basic", session });
    expect(second.masked).toBe("y [EMAIL_2] and [EMAIL_1]");
  });
  it("redact style is irreversible", () => {
    const r = maskText("a@x.com", { level: "basic", style: "redact" });
    expect(r.masked).toBe("[REDACTED]");
    expect(r.session.size).toBe(0);
  });
});

describe("restore", () => {
  it("round-trips masked text", () => {
    const r = maskText(SAMPLE, { level: "strict" });
    expect(restoreText(r.masked, r.session)).toBe(SAMPLE);
  });
  it("restores tokens inside a different reply and leaves unknown tokens", () => {
    const r = maskText("mail a@x.com", { level: "basic" });
    expect(restoreText("Reply to [EMAIL_1], not [EMAIL_9].", r.session)).toBe(
      "Reply to a@x.com, not [EMAIL_9].",
    );
  });
});

describe("resolver", () => {
  it("prefers higher priority, then confidence, then longer span", () => {
    const out = resolve([
      { entityType: "PHONE", start: 0, end: 16, confidence: 0.9, recognizerId: "a" },
      { entityType: "CREDIT_CARD", start: 0, end: 16, confidence: 0.5, recognizerId: "b" },
      { entityType: "DATE", start: 20, end: 25, confidence: 0.7, recognizerId: "c" },
      { entityType: "DATE", start: 22, end: 30, confidence: 0.7, recognizerId: "d" },
    ]);
    expect(out.map((f) => f.recognizerId)).toEqual(["b", "d"]);
  });
});

describe("robustness", () => {
  it("handles empty and large input quickly", () => {
    expect(analyze("")).toEqual([]);
    const big = "Contact a@x.com phone (415) 555-2671 note. ".repeat(3000); // ~130 KB
    const t = performance.now();
    const f = analyze(big, { level: "strict" });
    expect(f.length).toBe(6000);
    expect(performance.now() - t).toBeLessThan(2000);
  });
  it("makes no network calls", () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("network call attempted");
    }) as typeof fetch;
    try {
      maskText(SAMPLE, { level: "strict" });
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("false positives", () => {
  it.each([
    "const version = '1.2.3.4.5'; // build 20240315",
    "The meeting is at 10:30 on the 5th floor, room 12.",
    "Total: 1,234.56 USD (invoice 100200300)",
    "function foo(a, b) { return a + b; }",
  ])("leaves ordinary text alone: %s", (text) => {
    expect(analyze(text, { level: "standard" })).toEqual([]);
  });
});

describe("MaskSession.clone", () => {
  it("previews without changing the original", () => {
    const original = new MaskSession();
    maskText("a@x.com", { level: "basic", session: original });
    const copy = original.clone();
    const preview = maskText("b@x.com and a@x.com", { level: "basic", session: copy });
    expect(preview.masked).toBe("[EMAIL_2] and [EMAIL_1]");
    expect(copy.size).toBe(2);
    expect(original.size).toBe(1);
    // The next real use continues from the original numbering.
    expect(maskText("c@x.com", { level: "basic", session: original }).masked).toBe("[EMAIL_2]");
  });
});
