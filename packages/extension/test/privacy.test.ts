// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

const SRC = new URL("../src/", import.meta.url);
const sources = readdirSync(SRC).map((f) => ({ f, text: readFileSync(new URL(f, SRC), "utf8") }));

describe("privacy invariants", () => {
  it.each(["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "EventSource", "storage.sync"])(
    "extension source never uses %s",
    (banned) => {
      const offenders = sources.filter((s) => s.text.includes(banned)).map((s) => s.f);
      expect(offenders).toEqual([]);
    },
  );

  it("requests only the storage permission and only AI-site hosts", () => {
    expect(manifest.permissions).toEqual(["storage"]);
    for (const host of manifest.host_permissions) {
      expect(host).toMatch(
        /^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com)\/\*$/,
      );
    }
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });

  it("blocks network access from extension pages", () => {
    expect(manifest.content_security_policy.extension_pages).toContain("connect-src 'none'");
  });

  it("never writes user text with innerHTML", () => {
    expect(sources.filter((s) => /innerHTML|outerHTML|insertAdjacentHTML/.test(s.text))).toEqual(
      [],
    );
  });
});
