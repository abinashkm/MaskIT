# Architecture

> Status: core engine, name-model hook, file masking (with OCR), web app and Chrome extension are implemented and tested, including in a real browser (see [CHANGELOG](CHANGELOG.md)). The CLI and an in-extension file panel are **(planned)**.

## 1. Big picture
One shared engine, several thin front-ends. All processing is local.

```
 ┌────────────┐  ┌────────────┐  ┌──────────┐
 │ Chrome ext │  │  Web app   │  │   CLI    │   <- front-ends (UI + I/O only)
 └─────┬──────┘  └─────┬──────┘  └────┬─────┘     (CLI is planned)
       │               │ uses         │
       │         ┌─────▼──────┐       │
       │         │ files      │  <- file formats (CSV, DOCX, XLSX, text)
       │         └─────┬──────┘
       └───────────────┼──────────────┘
                 ┌─────▼──────┐
                 │   core     │   <- detection + masking engine (pure TypeScript, no DOM)
                 └─────▲──────┘
                       │ optional "Detector" plug-in
                 ┌─────┴──────┐
                 │    ner     │   <- on-device name / organization / place model
                 └────────────┘
```

Rule: **front-ends never contain detection logic.** Anything about finding or masking data lives in `core`; formats live in `files`; the model lives in `ner`.

## 2. Repository layout
```
packages/core/       detection + masking engine
packages/ner/        name model: token alignment, filters, Node detector, model download script
packages/files/      file format handlers: text, CSV/TSV, DOCX, XLSX (shared Office XML code)
packages/web/        static web app (React + Vite): text, files, PDF, OCR, name model
packages/extension/  Manifest V3 extension: content script, popup, service worker, offscreen page
packages/bench/      accuracy benchmark, realistic set, CI guard, generated reports
packages/e2e/        Playwright tests in real Chromium (web app and extension)
docs/                all documentation
```

## 3. Core engine (`packages/core`)

### 3.1 Data flow
```
input text
  -> Analyzer: runs the enabled Recognizers (and any Detectors) -> candidate Findings
  -> filter: drops disabled types and findings under the level's confidence threshold
  -> Resolver: removes overlaps -> final Findings
  -> Masker: replaces each finding using the chosen style -> masked text + Mapping
masked text -> user sends to AI
AI reply -> Restorer uses Mapping -> original values back (local only)
```

### 3.2 Key types (`types.ts`)
- **Recognizer:** `{ id, entityTypes, analyze(text) -> Finding[] }`. Synchronous, one per kind of data.
- **Detector:** `{ id, entityTypes, detect(text) -> Promise<Finding[]> }`. Asynchronous source such as the name model. Must not use the network.
- **Finding:** `{ entityType, start, end, confidence, recognizerId }`.
- **Level:** Basic, Standard, Strict, Custom: a set of enabled entity types plus a minimum confidence.
- **MaskSession:** token to original value, e.g. `[PERSON_1] -> "Jane Doe"`. The same value always gets the same token. `clone()` makes a scratch copy so a UI can preview without saving.

### 3.3 Public API (`index.ts`)
| Function | Purpose |
|---|---|
| `analyze(text, options)` | Resolved `Finding[]` from the built-in recognizers (synchronous) |
| `analyzeAsync(text, options, detectors)` | Same, plus detectors; a failing detector is skipped, never fatal |
| `maskText(text, options)` | Analyze, then replace findings; returns `{ masked, findings, session }` |
| `applyMask(text, findings, session, style)` | Mask only the findings a user approved |
| `restoreText(text, session)` | Put original values back into an AI reply |
| `MaskSession` | The mapping (sensitive; memory only) |

### 3.4 Source map
| File | Role |
|---|---|
| `types.ts` | Entity types, `Finding`, `Recognizer`, `Detector`, options |
| `levels.ts` | Which entity types and minimum confidence each level uses |
| `validators.ts` | Luhn, IBAN mod-97, ABA, SSN rules, IP validation |
| `recognizers/*.ts` | One recognizer per data kind, grouped by theme; `index.ts` lists them |
| `resolver.ts` | Entity priority table and overlap removal |
| `analyzer.ts` | `analyze` and `analyzeAsync`: run sources, apply level and confidence filters |
| `masker.ts` | `MaskSession`, token assignment, masking, restoring |

### 3.5 Detection layers
1. **Pattern recognizers:** regex plus validation (Luhn for cards, mod-97 for IBAN, ABA for routing numbers, structural SSN rules, real calendar dates, IP ranges). Validation removes most false positives.
2. **Context:** words near a match ("DOB", "Patient", "SSN", "phone") are required or raise confidence for ambiguous formats; words like "version" or "order" rule a match out.
3. **Name model (optional, `packages/ner`):** a quantized DistilBERT NER model finds names, organizations and places. It is a `Detector`; its hits pass through the same level, confidence and overlap rules, after generic plausibility filters (greeting words, short all-caps abbreviations, sentence-opening verbs, dotted initials, lowercase starts). English only.

### 3.6 Overlap resolution
When two findings overlap, the higher-priority entity type wins, then higher confidence, then the longer span. Priority follows validation strength: secrets, URL credentials, IBAN (mod-97), card (Luhn), SSN and other strongly validated types beat looser shapes such as phone and date. Example: digits inside an IBAN can pass Luhn by chance, so the IBAN must outrank the card or it would be lost.

### 3.7 Masking styles
Token (default, reversible) and redact (`[REDACTED]`, irreversible). Generalization and synthetic replacement are **(planned)**.

## 4. Name model (`packages/ner`)
- `align.ts` (pure, tested without the model): turns model word pieces into character spans (the model returns no offsets), joins pieces of one entity, maps PER/ORG/LOC to PERSON/ORGANIZATION/LOCATION, ignores MISC, applies the plausibility filters, calls hospital-like places organizations, and splits long text into chunks.
- `detector.ts`: `createNerDetector()` for Node (tests, benchmarks) using transformers.js with remote loading switched off.
- `scripts/fetch-model.mjs`: one-time developer or build step that downloads the model files into `packages/ner/models` (git-ignored). The product itself never downloads anything.
- Model: `onnx-community/distilbert-NER-ONNX`, 8-bit, about 66 MB; about 16 ms per sentence on a laptop CPU.

How each front-end hosts the model:
| Surface | Where the model runs | How it gets the files |
|---|---|---|
| Web app | A Web Worker (`ner.worker.ts`, client in `nerClient.ts`) with the WebAssembly runtime | `scripts/prepare-model.mjs` copies model and runtime into `public/`; the page serves them from its own origin |
| Extension | An offscreen page (`offscreen.ts`) started by the service worker (`background.ts`); the content script talks to it through `extNer.ts` | `scripts/build.mjs` copies model and runtime into `dist/` |
| Tests and benchmarks | Node (`onnxruntime-node`) | `fetch-model` |

If the model files are absent, every surface still works with the pattern rules and says the option is unavailable.

## 5. File masking (`packages/files`, `packages/web`)
`@maskit/files` only reads and writes file formats; detection still goes through `@maskit/core`, optionally with detectors. `maskFile()` is asynchronous.

| File | Role |
|---|---|
| `index.ts` | `maskFile()`: size limit, picks a handler by extension, returns bytes, tally, warnings, preview |
| `csv.ts` | Quote-aware CSV/TSV parser and writer, header hints (a "DOB" column is masked as a date of birth); the model is asked only about cells that read like text, up to a cap |
| `ooxml.ts` | Shared Office XML code: joins the text runs of a paragraph (Word) or shared-string item (Excel), masks them as one string, writes replacements back into the run where each finding starts; unzip with a size guard; document-property cleanup |
| `docx.ts` | Word: text, headers, footers, footnotes, endnotes, comments, tracked deletions; reviewer names and properties anonymized |
| `xlsx.ts` | Excel: shared strings, inline strings, comments, notes; author names and properties anonymized; numeric cells, sheet names and formulas are not scanned (the result says so) |
| `mask.ts` | Shared helpers |

Web-only parts (`packages/web/src`): `pdf.ts` (pdf.js text extraction and page rendering), `ocr.ts` (tesseract.js worker, image loading), `FilePanel.tsx` (the UI). PDF and images are masked as plain text. Scanned PDFs and images need the OCR option; the OCR worker, WebAssembly core and English language data are served from the page's own `public/ocr` (`scripts/prepare-ocr.mjs`).

## 6. Web app (`packages/web`)
React + Vite static page. It holds one `MaskSession` in React state.
- **Preview vs save:** the live preview masks on a *clone* of the session, so typing never stores half-typed values. The real session is updated only when the user uses the result (Copy button, copying the output, or masking a file).
- `useFindings.ts`: pattern rules answer immediately; when the name model is on, its result replaces them after a pause, and results that arrive after the text changed are discarded.
- Production builds carry a Content-Security-Policy: same-origin only (`connect-src 'self'`), no remote scripts, `wasm-unsafe-eval` for the model, no plain `unsafe-eval`.

## 7. Chrome extension (`packages/extension`)
- **Content script (`content.ts`):** on the four supported hosts. Catches Enter and Send clicks in the capture phase, decides through `guard.ts` (rules) or the model, shows the review dialog, holds the `MaskSession` in memory.
- **Name model in the extension:** with the option on, the prompt is checked in the background after a pause (`input` events, 400 ms) and the result is cached for that exact text. If the user sends before the check finished, the send is held, checked, then either the review dialog opens or the send is repeated for the user (one-shot bypass plus a click on the site's send button).
- **Service worker (`background.ts`):** creates the single offscreen page (creation is shared between tabs), forwards model requests with retries until the page listens, and only accepts messages from the extension's own scripts.
- **Offscreen page (`offscreen.ts`):** hosts the model; loads it lazily.
- **Popup (`popup.ts`):** enable switch, level, name option, custom words, tab status, and the restore tool.
- **Site adapters (`adapters.ts`):** the only place with site-specific selectors. Host matching accepts exact hosts and real subdomains only.
- **Editor layer (`editor.ts`):** reads and replaces prompt content for textareas and contenteditable editors, returns focus to the box, and reports failure so the UI can fall back to the clipboard.
- **UI (`ui.ts`):** review dialog, status badge and toast inside a closed shadow root; user text is inserted only with `textContent`.
- **Storage:** settings in `chrome.storage.local` (the synced store would upload custom words to Google). The token mapping lives only in content-script memory.
- **Send handling without the model:** block, mask on approval, the user presses send. With the model, a clean prompt that had to be held is sent for the user.
- **Build:** `scripts/build.mjs` (esbuild) outputs `dist/`: content script, popup and service worker as plain scripts, the offscreen page as an ES module, icons, and (if present) the model and runtime. About 87 MB with the model, about 3 MB without.

## 8. Tests and benchmarks
- **Unit tests** per package (Vitest). Privacy guards in `packages/extension/test/privacy.test.ts`: no `fetch`, `WebSocket`, `sendBeacon`, synced storage or `innerHTML` in extension source; permissions and CSP pinned; icons present.
- **Benchmarks** (`packages/bench`): a generated set, a hand-written realistic set, and (with the model) a name-model comparison. Reports in [BENCHMARKS.md](BENCHMARKS.md) and [BENCHMARKS-NER.md](BENCHMARKS-NER.md).
- **End-to-end** (`packages/e2e`): real Chromium. The web app is served from its production build. The extension is loaded unpacked and the chat sites are replaced by mock pages served at the real hostnames through request interception, built on the real editor libraries those sites use (ProseMirror, Quill) plus a plain textarea layout.

## 9. Privacy invariants
1. No network calls during analysis or masking (asserted by unit tests, the extension source scan, and browser tests that record every request).
2. No telemetry; no logging of user text.
3. The mapping is never written to persistent storage.
4. Extension permissions: storage, offscreen, and the four AI sites only.
5. The web page may read only its own origin; the extension pages may read only the extension's own files.
6. The model, OCR engine and language data are packaged files; nothing is fetched from a third party at run time.

## 10. Performance (measured on a laptop, Node)
- Pattern rules: a 130 KB text in well under 2 seconds (asserted in tests).
- Name model: about 16 ms per sentence; about 2 to 5 seconds to load the first time.
- OCR: about 2 seconds for a clean one-page image.
