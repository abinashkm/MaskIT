import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";
import { makeBlankPdf, makeDocx, makePdf, makeScannedPdf, makeXlsx } from "./fixtures";

const maskedBox = (page: Page) => page.locator("pre.masked").first();

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("masks the sample text and shows tokens", async ({ page }) => {
  await expect(maskedBox(page)).toContainText("[EMAIL_1]");
  const text = await maskedBox(page).innerText();
  for (const secret of ["jane.doe@example.com", "4111 1111 1111 1111", "123-45-6789", "hunter2!"]) {
    expect(text).not.toContain(secret);
  }
});

test("level changes what is masked", async ({ page }) => {
  await page.getByLabel("Level").selectOption("basic");
  const basic = await maskedBox(page).innerText();
  expect(basic).toContain("Jane Doe"); // names are standard and above
  await page.getByLabel("Level").selectOption("strict");
  await expect(maskedBox(page)).not.toContainText("March 20, 2024");
});

test("unticking a finding keeps that value", async ({ page }) => {
  await page.locator("ul.findings input[type=checkbox]").first().uncheck();
  const text = await maskedBox(page).innerText();
  expect(text).toMatch(/Jane Doe|03\/15\/1980/);
});

test("restores values from a reply that uses the tokens", async ({ page }) => {
  await page.getByPlaceholder("Project Falcon, Acme Corp").fill("Falcon");
  await page.locator("textarea").first().fill("Mail jane@example.com about Falcon");
  await expect(maskedBox(page)).toHaveText("Mail [EMAIL_1] about [CUSTOM_1]");
  await page.getByRole("button", { name: /Copy masked text/ }).click(); // saves the mapping
  const reply = page.locator("textarea").nth(1);
  await reply.fill("Sure, I will write to [EMAIL_1] about [CUSTOM_1].");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator("pre.masked").last()).toHaveText(
    "Sure, I will write to jane@example.com about Falcon.",
  );
});

test("production page ships a strict CSP", async ({ page }) => {
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  // Same-origin only: the page can read its own files (model, runtime) and nothing else.
  expect(csp).toContain("connect-src 'self'");
  // No web addresses, no wildcards, and no plain 'unsafe-eval' (only 'wasm-unsafe-eval').
  expect(csp).not.toMatch(/https?:|\*|'unsafe-eval'/);
});

async function upload(page: Page, name: string, data: Buffer, mimeType: string) {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer: data });
}

async function download(page: Page): Promise<Buffer> {
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /^Download/ }).click(),
  ]);
  return readFileSync((await dl.path()) as string);
}

test("masks a CSV file and offers a download", async ({ page }) => {
  await upload(
    page,
    "people.csv",
    Buffer.from("Name,Email,Notes\nJane Doe,jane@example.com,call (415) 555-2671\n"),
    "text/csv",
  );
  await expect(page.getByText("people.csv")).toBeVisible();
  const out = (await download(page)).toString("utf8");
  expect(out).toBe("Name,Email,Notes\n[PERSON_1],[EMAIL_1],call [PHONE_1]\n");
});

test("masks a DOCX across split runs and clears the creator", async ({ page }) => {
  await upload(
    page,
    "memo.docx",
    makeDocx(),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  await expect(page.getByText("memo.docx")).toBeVisible();
  const files = unzipSync(new Uint8Array(await download(page)));
  const doc = strFromU8(files["word/document.xml"] as Uint8Array);
  expect(doc).toContain("Write to [EMAIL_1]");
  expect(doc).not.toContain("example.com");
  expect(strFromU8(files["docProps/core.xml"] as Uint8Array)).toContain(
    "<dc:creator></dc:creator>",
  );
});

test("masks an XLSX workbook, keeps it a workbook, and warns about numeric cells", async ({
  page,
}) => {
  await upload(
    page,
    "sheet.xlsx",
    makeXlsx(),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  await expect(page.getByText("sheet.xlsx")).toBeVisible();
  await expect(page.getByText(/numeric cells/)).toBeVisible();
  const files = unzipSync(new Uint8Array(await download(page)));
  expect(strFromU8(files["xl/sharedStrings.xml"] as Uint8Array)).toContain("Mail [EMAIL_1]");
  expect(strFromU8(files["docProps/core.xml"] as Uint8Array)).toContain(
    "<dc:creator></dc:creator>",
  );
});

test("masks a text PDF through the pdf.js worker as plain text", async ({ page }) => {
  await upload(
    page,
    "letter.pdf",
    makePdf(["Email jane@example.com now", "Second line"]),
    "application/pdf",
  );
  await expect(page.getByText("letter.pdf")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/plain text/)).toBeVisible();
  const out = (await download(page)).toString("utf8");
  expect(out).toContain("[EMAIL_1]");
  expect(out).toContain("Second line");
  expect(out).not.toContain("jane@example.com");
});

test("refuses a PDF without selectable text", async ({ page }) => {
  await upload(page, "scan.pdf", makeBlankPdf(), "application/pdf");
  await expect(page.getByRole("alert")).toContainText("no selectable text", { timeout: 30_000 });
});

test("rejects unsupported file types", async ({ page }) => {
  await upload(page, "tool.exe", Buffer.from("MZ"), "application/octet-stream");
  await expect(page.getByRole("alert")).toContainText("Unsupported");
});

test("makes no network request beyond the page's own origin", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (!["localhost", ""].includes(url.hostname) && url.protocol.startsWith("http"))
      external.push(r.url());
  });
  await page.goto("/");
  await upload(page, "letter.pdf", makePdf(["Email jane@example.com now"]), "application/pdf");
  await expect(page.getByText("letter.pdf")).toBeVisible({ timeout: 30_000 });
  await upload(page, "n.csv", Buffer.from("a,b\n1,x@y.com\n"), "text/csv");
  await expect(page.getByText("n.csv")).toBeVisible();
  expect(external).toEqual([]);
});

const modelInstalled = existsSync(
  fileURLToPath(
    new URL(
      "../../web/public/models/onnx-community/distilbert-NER-ONNX/onnx/model_quantized.onnx",
      import.meta.url,
    ),
  ),
);

test.describe("on-device name model", () => {
  test.skip(!modelInstalled, "model not installed: pnpm --filter @maskit/ner fetch-model");

  test("masks names with no label, entirely from this site's own files", async ({ page }) => {
    const outside: string[] = [];
    const seen: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      seen.push(u.pathname);
      if (u.protocol.startsWith("http") && u.hostname !== "localhost") outside.push(r.url());
    });
    await page.goto("/");
    await page
      .locator("textarea")
      .first()
      .fill("Yesterday Priya Nair met Tom Becker at Northwind Traders.");
    // Rules alone do not know these names.
    await expect(maskedBox(page)).toHaveText(
      "Yesterday Priya Nair met Tom Becker at Northwind Traders.",
    );

    await page.getByLabel(/Find names, organizations and places/).check();
    await expect(page.getByText(/On\. The model runs in your browser|Checking/)).toBeVisible({
      timeout: 90_000,
    });
    await expect(maskedBox(page)).toHaveText(
      "Yesterday [PERSON_1] met [PERSON_2] at Northwind Traders.",
      { timeout: 30_000 },
    );

    await page.getByLabel("Level").selectOption("strict");
    await expect(maskedBox(page)).toContainText("[ORGANIZATION_1]", { timeout: 30_000 });

    expect(seen.some((p) => p.includes("/models/"))).toBe(true); // the model came from this site
    expect(outside).toEqual([]);
  });

  test("also masks names in an uploaded text file", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Find names, organizations and places/).check();
    await expect(page.getByText(/On\. The model runs in your browser|Checking/)).toBeVisible({
      timeout: 90_000,
    });
    await upload(
      page,
      "note.txt",
      Buffer.from("Spoke with Elena Gonzalez about the renewal."),
      "text/plain",
    );
    await expect(page.getByText("note.txt")).toBeVisible({ timeout: 30_000 });
    const out = (await download(page)).toString("utf8");
    expect(out).toBe("Spoke with [PERSON_1] about the renewal.");
  });
});

const ocrInstalled = existsSync(
  fileURLToPath(new URL("../../web/public/ocr/eng.traineddata", import.meta.url)),
);

/** Draws text onto a canvas in the browser and returns the PNG and the raw RGB pixels. */
async function drawText(page: Page, lines: string[]) {
  return page.evaluate((text) => {
    const w = 1100;
    const h = 100 + text.length * 90;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#000";
    x.font = "52px Arial, Helvetica, sans-serif";
    text.forEach((line, i) => x.fillText(line, 40, 90 + i * 90));
    const rgba = x.getImageData(0, 0, w, h).data;
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4) {
      rgb[j++] = rgba[i]!;
      rgb[j++] = rgba[i + 1]!;
      rgb[j++] = rgba[i + 2]!;
    }
    let bin = "";
    for (const b of rgb) bin += String.fromCharCode(b);
    return { w, h, png: c.toDataURL("image/png").split(",")[1]!, rgb: btoa(bin) };
  }, lines);
}

test.describe("OCR (scanned pages and images)", () => {
  test.skip(!ocrInstalled, "OCR files not installed: pnpm --filter @maskit/web prepare-ocr");

  test("asks for OCR to be turned on before reading an image", async ({ page }) => {
    const { png } = await drawText(page, ["Hello"]);
    await upload(page, "photo.png", Buffer.from(png, "base64"), "image/png");
    await expect(page.getByRole("alert")).toContainText("OCR");
  });

  test("reads an image, masks what it finds, and warns that OCR can misread", async ({ page }) => {
    const { png } = await drawText(page, [
      "Patient Jane Doe",
      "SSN 123-45-6789",
      "Visa 4111 1111 1111 1111",
    ]);
    await page.getByLabel(/Read scanned pages and images/).check();
    await upload(page, "photo.png", Buffer.from(png, "base64"), "image/png");
    await expect(page.getByText("photo.png")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/misread characters/)).toBeVisible();
    const out = (await download(page)).toString("utf8");
    expect(out).toContain("[US_SSN_1]");
    expect(out).toContain("[CREDIT_CARD_1]");
    expect(out).not.toContain("123-45-6789");
  });

  test("reads a scanned PDF that has no text layer", async ({ page }) => {
    const { w, h, rgb } = await drawText(page, ["Contact SSN 123-45-6789 today"]);
    await page.getByLabel(/Read scanned pages and images/).check();
    await upload(
      page,
      "scan.pdf",
      makeScannedPdf(w, h, Buffer.from(rgb, "base64")),
      "application/pdf",
    );
    await expect(page.getByText("scan.pdf")).toBeVisible({ timeout: 120_000 });
    const out = (await download(page)).toString("utf8");
    expect(out).toContain("[US_SSN_1]");
    expect(out).not.toContain("123-45-6789");
  });
});
