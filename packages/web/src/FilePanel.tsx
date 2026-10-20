import type { Detector, MaskLevel, MaskSession, MaskStyle } from "@maskit/core";
import { maskFile, SUPPORTED_EXTENSIONS, type MaskedFile } from "@maskit/files";
import { useEffect, useState } from "react";
import { IMAGE_EXTENSIONS, imageToCanvas, Ocr } from "./ocr";
import { extractPdfText, NoSelectableTextError, renderPdfPages } from "./pdf";

interface Props {
  level: MaskLevel;
  style: MaskStyle;
  customTerms: string[];
  detectors: Detector[];
  session: MaskSession;
  /** Called after masking saved new tokens into the session. */
  onMapped: () => void;
}

interface Result {
  inputName: string;
  file: MaskedFile;
  url: string;
}

const ACCEPT = [
  ...SUPPORTED_EXTENSIONS.map((e) => `.${e}`),
  ".pdf",
  ...IMAGE_EXTENSIONS.map((e) => `.${e}`),
].join(",");

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

const OCR_WARNING =
  "Text was read from images by OCR, which can misread characters: check the result carefully. The original image is not carried over.";

/** Runs OCR over one or more canvases and returns the recognized text. */
async function recognize(
  canvases: AsyncIterable<{ canvas: HTMLCanvasElement; page: number; pages: number }>,
  onProgress: (message: string) => void,
): Promise<string> {
  onProgress("Starting text recognition (first use takes a moment)...");
  let ocr: Ocr;
  try {
    ocr = await Ocr.create(onProgress);
  } catch {
    throw new Error("Text recognition (OCR) is not installed on this site.");
  }
  try {
    const parts: string[] = [];
    for await (const { canvas, page, pages } of canvases) {
      onProgress(`Reading page ${page} of ${pages}...`);
      parts.push(await ocr.recognize(canvas));
    }
    return parts.join("\n\n");
  } finally {
    await ocr.dispose();
  }
}

async function* single(canvas: HTMLCanvasElement) {
  yield { canvas, page: 1, pages: 1 };
}

async function process(
  file: File,
  props: Props,
  useOcr: boolean,
  onProgress: (message: string) => void,
): Promise<MaskedFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const options = {
    level: props.level,
    style: props.style,
    customTerms: props.customTerms,
    detectors: props.detectors,
    session: props.session,
  };
  const ext = extensionOf(file.name);
  const base = file.name.replace(/\.[^.]+$/, "");
  const asText = (text: string) => new TextEncoder().encode(text);

  if (IMAGE_EXTENSIONS.includes(ext)) {
    if (!useOcr) {
      throw new Error('To read an image, turn on "Read scanned pages and images (OCR)" first.');
    }
    const text = await recognize(single(await imageToCanvas(file)), onProgress);
    if (text.trim() === "") throw new Error("No text was found in this image.");
    const result = await maskFile(`${base}.txt`, asText(text), options);
    result.warnings.push(OCR_WARNING);
    return result;
  }

  if (ext === "pdf") {
    let text: string;
    let ocrUsed = false;
    try {
      text = await extractPdfText(bytes);
    } catch (e) {
      if (!(e instanceof NoSelectableTextError) || !useOcr) throw e;
      text = await recognize(renderPdfPages(bytes), onProgress);
      ocrUsed = true;
      if (text.trim() === "") throw new Error("No text was found in this PDF.");
    }
    const result = await maskFile(`${base}.txt`, asText(text), options);
    result.warnings.push(
      "PDFs are masked as plain text: the original layout, images and metadata are not carried over.",
    );
    if (ocrUsed) result.warnings.push(OCR_WARNING);
    return result;
  }

  return await maskFile(file.name, bytes, options);
}

export function FilePanel(props: Props) {
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [useOcr, setUseOcr] = useState(false);

  // Release the download link when it is replaced or the panel goes away.
  useEffect(() => () => result && URL.revokeObjectURL(result.url), [result]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setProgress("");
    setBusy(true);
    try {
      const masked = await process(file, props, useOcr, setProgress);
      const blob = new Blob([masked.data as BlobPart], { type: masked.mimeType });
      setResult({ inputName: file.name, file: masked, url: URL.createObjectURL(blob) });
      props.onMapped();
    } catch (e) {
      setResult(undefined);
      setError(e instanceof Error ? e.message : "Could not process this file.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const total = result ? [...result.file.tally.values()].reduce((a, b) => a + b, 0) : 0;

  return (
    <section>
      <h2>Mask a file</h2>
      <p className="muted">
        Supported: {SUPPORTED_EXTENSIONS.join(", ")}, pdf, and images (with OCR), up to 25 MB. The
        file is read and masked in this tab; it is never uploaded.
      </p>
      <label className="check">
        <span>
          <input
            type="checkbox"
            checked={useOcr}
            onChange={(e) => setUseOcr(e.target.checked)}
            disabled={busy}
          />{" "}
          Read scanned pages and images (OCR, English)
        </span>
        <small>
          Needed for scanned PDFs and image files. Runs on this device and can take several seconds
          per page.
        </small>
      </label>
      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files[0]);
        }}
      >
        {busy ? progress || "Working..." : "Choose a file or drop it here"}
        <input
          type="file"
          accept={ACCEPT}
          disabled={busy}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="result" aria-live="polite">
          <p>
            <strong>{result.inputName}</strong>: {total} item(s) masked
            {total > 0 &&
              ` (${[...result.file.tally.entries()].map(([t, n]) => `${t} x${n}`).join(", ")})`}
            .
          </p>
          {result.file.warnings.map((w) => (
            <p key={w} className="warning">
              {w}
            </p>
          ))}
          {result.file.preview !== undefined && <pre className="masked">{result.file.preview}</pre>}
          <a className="button" href={result.url} download={result.file.outputName}>
            Download {result.file.outputName}
          </a>
          <p className="muted">Review the result before sharing it: no tool catches everything.</p>
        </div>
      )}
    </section>
  );
}
