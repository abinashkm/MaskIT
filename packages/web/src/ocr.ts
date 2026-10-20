/**
 * Text recognition (OCR) for scanned pages and images, run in a worker from this site's own
 * files. Nothing is downloaded at run time.
 */
import type { Worker as TesseractWorker } from "tesseract.js";

/** Longest side, in pixels, that is sent to the recognizer; larger images are shrunk. */
const MAX_SIDE = 3000;

export type OcrProgress = (message: string) => void;

export class Ocr {
  private worker: TesseractWorker | undefined;

  static async create(onProgress?: OcrProgress): Promise<Ocr> {
    const { createWorker } = await import("tesseract.js");
    const ocr = new Ocr();
    ocr.worker = await createWorker("eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/",
      langPath: "/ocr/",
      gzip: false,
      workerBlobURL: false, // a blob worker would not be covered by the page's security policy
      cacheMethod: "none",
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          onProgress?.(`Reading text... ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    return ocr;
  }

  async recognize(source: HTMLCanvasElement): Promise<string> {
    if (!this.worker) throw new Error("OCR is not ready");
    const { data } = await this.worker.recognize(source);
    return data.text;
  }

  async dispose(): Promise<void> {
    await this.worker?.terminate();
    this.worker = undefined;
  }
}

/** Draws an image file onto a canvas, shrinking it if it is very large. */
export async function imageToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the image");
  ctx.fillStyle = "#fff"; // transparent areas would otherwise read as black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];
