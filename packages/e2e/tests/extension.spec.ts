import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mockPage, type Site } from "./mock-editors";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const DIST = join(ROOT, "packages/extension/dist");

const SITES: { site: Site; url: string }[] = [
  { site: "claude", url: "https://claude.ai/new" },
  { site: "chatgpt", url: "https://chatgpt.com/" },
  { site: "gemini", url: "https://gemini.google.com/app" },
  { site: "chatgpt-textarea", url: "https://chatgpt.com/textarea" },
];

let context: BrowserContext;
let extensionId = "";
const externalRequests: string[] = [];

test.beforeAll(async () => {
  execSync("pnpm --filter @maskit/extension build", { cwd: ROOT, stdio: "ignore" });

  // Copy the build and give it a fixed key so its id is known without a service worker.
  const dir = mkdtempSync(join(tmpdir(), "maskit-ext-"));
  cpSync(DIST, dir, { recursive: true });
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const der = publicKey.export({ type: "spki", format: "der" });
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  manifest.key = der.toString("base64");
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
  extensionId = [...createHash("sha256").update(der).digest().subarray(0, 16)]
    .map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15)))
    .join("");

  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "maskit-prof-")), {
    channel: "chromium",
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });

  // Serve the mock chat pages at the real hostnames; nothing leaves the machine. One handler
  // per origin (a later handler would shadow an earlier one), choosing the layout by path.
  const siteByHost: Record<string, Site> = {
    "claude.ai": "claude",
    "chatgpt.com": "chatgpt",
    "gemini.google.com": "gemini",
  };
  for (const [host, site] of Object.entries(siteByHost)) {
    await context.route(`https://${host}/**`, async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/favicon.ico") return route.fulfill({ status: 204 });
      // chatgpt.com serves two layouts: the editor page at "/" and a textarea page at "/textarea".
      const which: Site = u.pathname === "/textarea" ? "chatgpt-textarea" : site;
      await route.fulfill({ contentType: "text/html", body: await mockPage(which) });
    });
  }
  context.on("request", (r) => {
    const host = new URL(r.url()).hostname;
    if (!["claude.ai", "chatgpt.com", "gemini.google.com", extensionId].includes(host)) {
      if (r.url().startsWith("http")) externalRequests.push(r.url());
    }
  });
});

test.afterAll(async () => {
  await context?.close();
});

async function open(url: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() =>
    Array.isArray((window as unknown as { __sent?: unknown }).__sent),
  );
  return page;
}

const sent = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sent: string[] }).__sent);
const boxText = (page: Page) =>
  page.evaluate(() => (window as unknown as { __text: () => string }).__text());

async function setSettings(settings: Record<string, unknown>) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate((s) => chrome.storage.local.set({ "maskit.settings": s }), settings);
  await page.close();
}

test.beforeEach(async () => {
  await setSettings({ enabled: true, level: "standard", customTerms: [] });
});

for (const { site, url } of SITES) {
  test.describe(site, () => {
    test("blocks the send, masks on approval, then sends the masked text", async () => {
      const page = await open(url);
      await page
        .locator(
          "#editor [contenteditable], #editor.ProseMirror, .ql-editor, #mobile-composer-prompt",
        )
        .first()
        .click();
      await page.keyboard.type("My email is jane@example.com please");
      await page.keyboard.press("Enter"); // intercepted: dialog opens with "Mask selected" focused
      await page.waitForTimeout(300);
      expect(await sent(page)).toEqual([]);
      await page.keyboard.press("Enter"); // activates "Mask selected"
      await expect.poll(() => boxText(page)).toBe("My email is [EMAIL_1] please");
      expect(await sent(page)).toEqual([]);
      await page.keyboard.press("Enter"); // masked text has nothing to flag
      await expect.poll(() => sent(page)).toEqual(["My email is [EMAIL_1] please"]);
    });

    test("lets clean text through immediately", async () => {
      const page = await open(url);
      await page
        .locator(
          "#editor [contenteditable], #editor.ProseMirror, .ql-editor, #mobile-composer-prompt",
        )
        .first()
        .click();
      await page.keyboard.type("What is the capital of France?");
      await page.keyboard.press("Enter");
      await expect.poll(() => sent(page)).toEqual(["What is the capital of France?"]);
    });

    test("intercepts the send button too", async () => {
      const page = await open(url);
      await page
        .locator(
          "#editor [contenteditable], #editor.ProseMirror, .ql-editor, #mobile-composer-prompt",
        )
        .first()
        .click();
      await page.keyboard.type("Card 4111 1111 1111 1111");
      await page.locator("#send").click();
      await page.waitForTimeout(300);
      expect(await sent(page)).toEqual([]);
      await page.keyboard.press("Enter");
      await expect.poll(() => boxText(page)).toBe("Card [CREDIT_CARD_1]");
    });

    test("Escape cancels and keeps the original text", async () => {
      const page = await open(url);
      await page
        .locator(
          "#editor [contenteditable], #editor.ProseMirror, .ql-editor, #mobile-composer-prompt",
        )
        .first()
        .click();
      await page.keyboard.type("SSN 123-45-6789");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      expect(await boxText(page)).toBe("SSN 123-45-6789");
      expect(await sent(page)).toEqual([]);
    });

    test("send without masking works exactly once", async () => {
      const page = await open(url);
      const editor = page
        .locator(
          "#editor [contenteditable], #editor.ProseMirror, .ql-editor, #mobile-composer-prompt",
        )
        .first();
      await editor.click();
      await page.keyboard.type("mail a@b.com");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      await page.keyboard.press("Shift+Tab"); // Mask selected -> Send without masking
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      await editor.click();
      await page.keyboard.press("Enter"); // allowed once
      await expect.poll(() => sent(page)).toEqual(["mail a@b.com"]);
      await page.keyboard.type("again c@d.com");
      await page.keyboard.press("Enter"); // checked again
      await page.waitForTimeout(300);
      expect(await sent(page)).toEqual(["mail a@b.com"]);
    });

    test("does nothing when switched off in settings", async () => {
      await setSettings({ enabled: false, level: "standard", customTerms: [] });
      const page = await open(url);
      await page
        .locator(
          "#editor [contenteditable], #editor.ProseMirror, .ql-editor, #mobile-composer-prompt",
        )
        .first()
        .click();
      await page.keyboard.type("mail a@b.com");
      await page.keyboard.press("Enter");
      await expect.poll(() => sent(page)).toEqual(["mail a@b.com"]);
    });
  });
}

test("restores a reply through the content script, with the same mapping", async () => {
  const page = await open(SITES[0]!.url);
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.type("write to jane@example.com");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await expect.poll(() => boxText(page)).toBe("write to [EMAIL_1]");

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const reply = await popup.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "https://claude.ai/*" });
    return chrome.tabs.sendMessage(tab!.id!, {
      type: "maskit:restore",
      text: "Sent to [EMAIL_1].",
    });
  });
  expect(reply).toMatchObject({ ok: true, text: "Sent to jane@example.com.", known: 1 });
});

test("custom words from settings are masked", async () => {
  await setSettings({ enabled: true, level: "basic", customTerms: ["Project Falcon"] });
  const page = await open(SITES[0]!.url);
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.type("Status of Project Falcon?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await expect.poll(() => boxText(page)).toBe("Status of [CUSTOM_1]?");
});

test("makes no requests beyond the pages themselves", () => {
  expect(externalRequests).toEqual([]);
});

const modelInstalled = existsSync(
  join(DIST, "models/onnx-community/distilbert-NER-ONNX/onnx/model_quantized.onnx"),
);

/** Waits until the page's content script reports that the name model is loaded. */
async function waitForNames(): Promise<void> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect
    .poll(
      async () =>
        popup.evaluate(async () => {
          const [tab] = await chrome.tabs.query({ url: "https://claude.ai/*" });
          const reply = await chrome.tabs.sendMessage(tab!.id!, { type: "maskit:names-status" });
          return (reply as { names: string }).names;
        }),
      { timeout: 120_000, intervals: [500] },
    )
    .toBe("ready");
  await popup.close();
}

test.describe("name model in the extension", () => {
  test.skip(!modelInstalled, "model not installed: pnpm --filter @maskit/ner fetch-model");

  test.beforeEach(async () => {
    await setSettings({ enabled: true, level: "standard", customTerms: [], names: true });
  });

  test("masks a name that has no label after the user pauses typing", async () => {
    const page = await open(SITES[0]!.url);
    await waitForNames();
    await page.locator(".ProseMirror").first().click();
    await page.keyboard.type("Yesterday Priya Nair met Tom Becker at the office");
    await page.waitForTimeout(2500); // typing paused: the check runs in the background
    await page.keyboard.press("Enter"); // blocked, dialog opens
    await page.waitForTimeout(300);
    expect(await sent(page)).toEqual([]);
    await page.keyboard.press("Enter"); // Mask selected
    await expect
      .poll(() => boxText(page))
      .toBe("Yesterday [PERSON_1] met [PERSON_2] at the office");
  });

  test("holds a send made right after typing until the model has looked", async () => {
    const page = await open(SITES[0]!.url);
    await waitForNames();
    await page.locator(".ProseMirror").first().click();
    await page.keyboard.type("Call Elena Gonzalez about the renewal");
    await page.keyboard.press("Enter"); // immediately: no time for the background check
    await page.waitForTimeout(3000);
    expect(await sent(page)).toEqual([]); // held, then the dialog opened
    await page.keyboard.press("Enter"); // Mask selected
    await expect.poll(() => boxText(page)).toBe("Call [PERSON_1] about the renewal");
  });

  test("sends clean text for the user once the check finds nothing", async () => {
    const page = await open(SITES[0]!.url);
    await waitForNames();
    await page.locator(".ProseMirror").first().click();
    await page.keyboard.type("What is the capital of France?");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => sent(page), { timeout: 20_000 })
      .toEqual(["What is the capital of France?"]);
  });
});
