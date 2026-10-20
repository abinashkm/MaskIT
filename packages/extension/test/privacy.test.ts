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

  it("requests only the storage and offscreen permissions and only AI-site hosts", () => {
    // "offscreen" lets the extension keep the on-device name model in a hidden page of its own.
    expect(manifest.permissions).toEqual(["storage", "offscreen"]);
    for (const host of manifest.host_permissions) {
      expect(host).toMatch(
        /^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com)\/\*$/,
      );
    }
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });

  it("limits extension pages to their own files", () => {
    const csp = manifest.content_security_policy.extension_pages;
    expect(csp).toContain("connect-src 'self'"); // only the extension's own files
    expect(csp).not.toMatch(/https?:|\*|'unsafe-eval'/);
  });

  it("never writes user text with innerHTML", () => {
    expect(sources.filter((s) => /innerHTML|outerHTML|insertAdjacentHTML/.test(s.text))).toEqual(
      [],
    );
  });
});

describe("store requirements", () => {
  it("ships every icon the manifest names, as real PNG files", () => {
    const named = new Set([
      ...Object.values(manifest.icons as Record<string, string>),
      ...Object.values(manifest.action.default_icon as Record<string, string>),
    ]);
    expect(named.size).toBeGreaterThanOrEqual(4);
    for (const rel of named) {
      const file = readFileSync(new URL(`../${rel}`, import.meta.url));
      expect([...file.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
  });
});
