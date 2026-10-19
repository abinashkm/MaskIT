import type { MaskLevel, MaskSession, MaskStyle } from "@maskit/core";
import { maskFile, SUPPORTED_EXTENSIONS, type MaskedFile } from "@maskit/files";
import { useEffect, useState } from "react";
import { extractPdfText } from "./pdf";

interface Props {
  level: MaskLevel;
  style: MaskStyle;
  customTerms: string[];
  session: MaskSession;
}

interface Result {
  inputName: string;
  file: MaskedFile;
  url: string;
}

async function process(file: File, props: Props): Promise<MaskedFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const options = {
    level: props.level,
    style: props.style,
    customTerms: props.customTerms,
    session: props.session,
  };
  if (/\.pdf$/i.test(file.name)) {
    const text = await extractPdfText(bytes);
    const result = maskFile(
      file.name.replace(/\.pdf$/i, ".txt"),
      new TextEncoder().encode(text),
      options,
    );
    result.warnings.push(
      "PDFs are masked as plain text: the original layout, images and metadata are not carried over.",
    );
    return result;
  }
  return maskFile(file.name, bytes, options);
}

export function FilePanel(props: Props) {
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Release the download link when it is replaced or the panel goes away.
  useEffect(() => () => result && URL.revokeObjectURL(result.url), [result]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const masked = await process(file, props);
      const blob = new Blob([masked.data as BlobPart], { type: masked.mimeType });
      setResult({ inputName: file.name, file: masked, url: URL.createObjectURL(blob) });
    } catch (e) {
      setResult(undefined);
      setError(e instanceof Error ? e.message : "Could not process this file.");
    } finally {
      setBusy(false);
    }
  }

  const total = result ? [...result.file.tally.values()].reduce((a, b) => a + b, 0) : 0;

  return (
    <section>
      <h2>Mask a file</h2>
      <p className="muted">
        Supported: {SUPPORTED_EXTENSIONS.join(", ")}, pdf (up to 25 MB). The file is read and masked
        in this tab; it is never uploaded.
      </p>
      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files[0]);
        }}
      >
        {busy ? "Working..." : "Choose a file or drop it here"}
        <input
          type="file"
          accept=".txt,.md,.log,.json,.csv,.tsv,.docx,.pdf"
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
