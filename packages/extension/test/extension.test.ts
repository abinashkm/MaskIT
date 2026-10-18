import { beforeEach, describe, expect, it, vi } from "vitest";
import { adapterFor, findInput, isInInput, isSendControl, ADAPTERS } from "../src/adapters";
import { readText, writeText } from "../src/editor";
import { evaluate, SendBypass } from "../src/guard";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("adapterFor", () => {
  it("matches exact hosts and real subdomains", () => {
    expect(adapterFor("claude.ai")?.id).toBe("claude");
    expect(adapterFor("chatgpt.com")?.id).toBe("chatgpt");
    expect(adapterFor("gemini.google.com")?.id).toBe("gemini");
    expect(adapterFor("www.claude.ai")?.id).toBe("claude");
  });
  it("rejects look-alike and unrelated hosts", () => {
    expect(adapterFor("evilclaude.ai")).toBeUndefined();
    expect(adapterFor("claude.ai.evil.com")).toBeUndefined();
    expect(adapterFor("example.com")).toBeUndefined();
  });
  it("covers every host listed in the manifest", async () => {
    const manifest = (await import("../manifest.json")).default;
    const hosts = manifest.host_permissions.map(
      (h: string) => new URL(h.replace("*", "x")).hostname,
    );
    for (const host of hosts) expect(adapterFor(host), host).toBeDefined();
    expect(ADAPTERS.flatMap((a) => a.hosts).sort()).toEqual([...hosts].sort());
  });
});

describe("adapter DOM helpers", () => {
  const claude = ADAPTERS.find((a) => a.id === "claude")!;
  it("finds the prompt box from an inner element and from the page", () => {
    document.body.innerHTML = `<div contenteditable="true" class="ProseMirror"><p id="p">hi</p></div>
      <button aria-label="Send message" id="send"><svg id="icon"></svg></button>`;
    const inner = document.getElementById("p");
    expect(findInput(claude, inner)?.className).toBe("ProseMirror");
    expect(findInput(claude)?.className).toBe("ProseMirror");
    expect(isInInput(claude, inner)).toBe(true);
    expect(isInInput(claude, document.getElementById("send"))).toBe(false);
    expect(isSendControl(claude, document.getElementById("icon"))).toBe(true);
  });
  it("returns null when the page has no prompt box", () => {
    expect(findInput(claude)).toBeNull();
  });
});

describe("editor", () => {
  it("reads and writes a textarea and notifies the page", () => {
    const ta = document.createElement("textarea");
    ta.value = "old";
    document.body.append(ta);
    const onInput = vi.fn();
    ta.addEventListener("input", onInput);
    expect(writeText(ta, "new [EMAIL_1]")).toBe(true);
    expect(readText(ta)).toBe("new [EMAIL_1]");
    expect(onInput).toHaveBeenCalledOnce();
  });
  it("reports failure when a rich editor rejects the edit", () => {
    const div = document.createElement("div");
    div.contentEditable = "true";
    div.textContent = "secret@example.com";
    document.body.append(div);
    document.execCommand = vi.fn(() => false);
    expect(writeText(div, "[EMAIL_1]")).toBe(false);
  });
  it("accepts a rich-editor edit that differs only in whitespace", () => {
    const div = document.createElement("div");
    div.contentEditable = "true";
    document.body.append(div);
    document.execCommand = vi.fn((_cmd: string, _ui?: boolean, value?: string) => {
      div.textContent = (value ?? "").replace(/\n/g, "  \n ");
      return true;
    });
    expect(writeText(div, "line one\nline two")).toBe(true);
  });
});

describe("guard", () => {
  it("returns findings only when enabled and text is non-empty", () => {
    const text = "mail jane@example.com";
    expect(evaluate(text, DEFAULT_SETTINGS)).toHaveLength(1);
    expect(evaluate(text, { ...DEFAULT_SETTINGS, enabled: false })).toEqual([]);
    expect(evaluate("   ", DEFAULT_SETTINGS)).toEqual([]);
    expect(evaluate("nothing here", DEFAULT_SETTINGS)).toEqual([]);
  });
  it("honours level and custom words", () => {
    const text = "Patient: Jane Doe, Project Falcon";
    expect(evaluate(text, { ...DEFAULT_SETTINGS, level: "basic" })).toEqual([]);
    const types = evaluate(text, { ...DEFAULT_SETTINGS, customTerms: ["Project Falcon"] }).map(
      (f) => f.entityType,
    );
    expect(types).toEqual(["PERSON", "CUSTOM"]);
  });
});

describe("SendBypass", () => {
  it("is one-shot", () => {
    const b = new SendBypass(() => 0);
    expect(b.consume()).toBe(false);
    b.allowNext();
    expect(b.consume()).toBe(true);
    expect(b.consume()).toBe(false);
  });
  it("expires", () => {
    let now = 0;
    const b = new SendBypass(() => now, 10_000);
    b.allowNext();
    now = 10_001;
    expect(b.consume()).toBe(false);
  });
});

describe("normalizeSettings", () => {
  it("fills defaults for missing or corrupt data", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("junk")).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({ level: "custom", enabled: "yes", customTerms: [1, " ", "ok"] }),
    ).toEqual({
      enabled: true,
      level: "standard",
      customTerms: ["ok"],
    });
  });
  it("keeps valid values", () => {
    expect(normalizeSettings({ enabled: false, level: "strict", customTerms: ["x"] })).toEqual({
      enabled: false,
      level: "strict",
      customTerms: ["x"],
    });
  });
});
