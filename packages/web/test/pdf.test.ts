import { describe, expect, it } from "vitest";
import { assemblePageText } from "../src/pdf";

describe("assemblePageText", () => {
  it("joins items, breaks lines at hasEOL and ignores non-text items", () => {
    expect(
      assemblePageText([
        { str: "Email jane@example.com now", hasEOL: true },
        { type: "beginMarkedContent" },
        { str: "Second", hasEOL: false },
        { str: "line", hasEOL: true },
      ]),
    ).toBe("Email jane@example.com now\nSecond line");
  });
  it("returns an empty string for a page with no text", () => {
    expect(assemblePageText([])).toBe("");
  });
});
