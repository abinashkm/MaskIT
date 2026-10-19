interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
}

/** Joins pdf.js text items into lines; pure so it can be tested without a PDF. */
export function assemblePageText(items: readonly (TextItemLike | object)[]): string {
  let out = "";
  for (const item of items as TextItemLike[]) {
    if (typeof item.str !== "string") continue;
    out += item.str;
    out += item.hasEOL ? "\n" : " ";
  }
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

/**
 * Pulls selectable text out of a PDF, in the browser. The output is masked as plain text
 * (true in-place PDF redaction is not offered), so nothing of the original layout survives.
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  // Loaded on demand so the PDF engine does not weigh down pages that never use it.
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({
    data: data.slice(), // pdf.js takes ownership of the buffer
    isEvalSupported: false, // keeps the strict CSP intact
  }).promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(assemblePageText(content.items));
    }
    const text = pages.join("\n\n");
    if (text.trim() === "") {
      throw new Error(
        "This PDF has no selectable text (it looks scanned). Reading scanned pages needs OCR, which is not available yet.",
      );
    }
    return text;
  } finally {
    await doc.destroy();
  }
}
