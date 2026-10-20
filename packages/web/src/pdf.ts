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

/** Thrown when a PDF has pages but no text layer (a scan); the caller may offer OCR. */
export class NoSelectableTextError extends Error {
  constructor() {
    super(
      'This PDF has no selectable text (it looks scanned). Turn on "Read scanned pages and images (OCR)" and try again.',
    );
    this.name = "NoSelectableTextError";
  }
}

async function openPdf(data: Uint8Array) {
  // Loaded on demand so the PDF engine does not weigh down pages that never use it.
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({
    data: data.slice(), // pdf.js takes ownership of the buffer
    isEvalSupported: false, // keeps the strict CSP intact
  }).promise;
}

/**
 * Pulls selectable text out of a PDF, in the browser. The output is masked as plain text
 * (true in-place PDF redaction is not offered), so nothing of the original layout survives.
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const doc = await openPdf(data);
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(assemblePageText(content.items));
    }
    const text = pages.join("\n\n");
    if (text.trim() === "") throw new NoSelectableTextError();
    return text;
  } finally {
    await doc.destroy();
  }
}

/** Longest side, in pixels, of a rendered page; keeps OCR from getting very slow. */
const MAX_PAGE_SIDE = 3000;

/** Draws each page onto a canvas so a scanned PDF can be read by OCR. */
export async function* renderPdfPages(
  data: Uint8Array,
): AsyncGenerator<{ canvas: HTMLCanvasElement; page: number; pages: number }> {
  const doc = await openPdf(data);
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, MAX_PAGE_SIDE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare the page");
      await page.render({ canvasContext: ctx, viewport }).promise;
      yield { canvas, page: n, pages: doc.numPages };
    }
  } finally {
    await doc.destroy();
  }
}
