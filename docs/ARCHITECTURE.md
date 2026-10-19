# Architecture

> Status: `packages/core` is implemented (Phase 1 engine). Extension, web app, CLI, file parsers and NER are **(planned)**. Update this doc as code lands.

## 1. Big picture
One shared engine, several thin front-ends. All processing is local.

```
 ┌────────────┐  ┌────────────┐  ┌──────────┐
 │ Chrome ext │  │  Web app   │  │   CLI    │   <- front-ends (UI + I/O only)
 └─────┬──────┘  └─────┬──────┘  └────┬─────┘
       └───────────────┼──────────────┘
                 ┌─────▼──────┐
                 │ packages/  │   <- core engine (pure TypeScript, no DOM)
                 │   core     │
                 └────────────┘
```

Rule: **front-ends never contain detection logic.** Anything about finding or masking data lives in `core`.

## 2. Repository layout
```
packages/core/       detection + masking engine (implemented)
packages/extension/  Manifest V3 extension (content script, popup)
packages/files/      file format handlers: CSV, DOCX, text (implemented)
packages/web/        static web app (React + Vite) (implemented)
packages/cli/        batch CLI (later)
docs/                all documentation
```

## 3. Core engine

### 3.1 Data flow
```
input text
  -> Analyzer: runs all enabled Recognizers  -> list of Findings
  -> Resolver: removes overlaps, applies level filter and confidence threshold
  -> Masker: replaces each finding using the chosen style -> masked text + Mapping
masked text -> user sends to AI
AI reply -> Restorer uses Mapping -> original values back (local only)
```

### 3.2 Key types (implemented, `packages/core/src/types.ts`)
- **Recognizer:** `{ id, entityType, analyze(text) -> Finding[] }`. One per kind of data (email, card, ...).
- **Finding:** `{ entityType, start, end, confidence, recognizerId }`.
- **Level:** Basic, Standard, Strict, Custom. A level is a set of enabled entity types plus a confidence threshold.
- **Mapping:** token to original value, e.g. `[PERSON_1] -> "Jane Doe"`. Same value always gets the same token in a session.

### 3.2a Public API (`packages/core/src/index.ts`)
| Function | Purpose |
|---|---|
| `analyze(text, options)` | Returns resolved `Finding[]` for the chosen level |
| `maskText(text, options)` | Analyze, then replace findings; returns `{ masked, findings, session }` |
| `applyMask(text, findings, session, style)` | Mask only the findings a user approved in the review UI |
| `restoreText(text, session)` | Put original values back into an AI reply |
| `MaskSession` | Holds the token to value mapping (sensitive; memory only) |

### 3.2b Source map
| File | Role |
|---|---|
| `types.ts` | Entity types, `Finding`, `Recognizer`, options |
| `levels.ts` | Which entity types and minimum confidence each level uses |
| `validators.ts` | Luhn, IBAN mod-97, ABA, SSN rules, IP validation |
| `recognizers/*.ts` | One recognizer per data kind, grouped by theme; `index.ts` lists them |
| `resolver.ts` | Entity priority table and overlap removal |
| `analyzer.ts` | Runs recognizers, applies level and confidence filters |
| `masker.ts` | `MaskSession`, token assignment, masking, restoring |

### 3.3 Detection layers
1. **Pattern recognizers (implemented):** regex plus validation (Luhn for cards, mod-97 for IBAN, structural SSN rules). Validation removes most false positives.
2. **Context scoring (implemented as required or boosting context):** words near a match ("DOB", "Patient", "MRN") raise or lower confidence.
3. **NER (optional):** quantized ONNX model in a Web Worker for names, organizations, locations. Loaded only if the user enables it.

### 3.4 Overlap resolution
When two findings overlap, the higher-priority entity type wins, then the higher confidence, then the longer span. Example: a string detected as both a phone number and a generic number resolves to phone.

### 3.5 Masking styles
Token (default), full redaction, generalization (date to year), synthetic replacement.

## 3b. Web app (implemented, `packages/web`)
A static React + Vite page. It imports `@maskit/core` and holds one `MaskSession` in React state. Flow: text, level, style and custom words go into `analyze()`; the user unticks findings in the review list; `applyMask()` produces the output; `restoreText()` handles AI replies. Production builds carry a CSP with `connect-src 'none'`.

## 3c. File masking (implemented, `packages/files` and `packages/web`)
`@maskit/files` only reads and writes file formats; all detection still goes through `@maskit/core`.

| File | Role |
|---|---|
| `index.ts` | `maskFile()`: size limit, picks a handler by extension, returns bytes, tally, warnings, preview |
| `csv.ts` | Quote-aware CSV/TSV parser and writer, header hints (a "DOB" column is masked as a date of birth) |
| `docx.ts` | Unzips the DOCX, masks text per paragraph across runs, masks tracked deletions, anonymizes reviewer names and document properties, re-zips |
| `mask.ts` | Shared helpers: mask a string, count findings, create replacement tokens |

PDF is handled in the web app only (`packages/web/src/pdf.ts`) because pdf.js needs a browser: it extracts text, then the text goes through `maskFile` as a `.txt`. The UI is `FilePanel.tsx`. All of it shares the app's `MaskSession`.

## 4. Chrome extension (implemented, `packages/extension`; not yet verified on live sites)
- **Content script (`content.ts`):** attached to the four supported hosts. Catches Enter and Send clicks in the capture phase, calls the engine through `guard.ts`, shows the review dialog, and holds the `MaskSession`.
- **No service worker:** not needed yet; settings are read directly from storage and the popup talks to the content script by message.
- **Popup (`popup.ts`):** enable switch, level, custom words, tab status, and the restore tool.
- **Site adapters (`adapters.ts`):** the only place with site-specific selectors; one entry per site. Host matching accepts exact hosts and real subdomains only.
- **Editor layer (`editor.ts`):** reads and replaces prompt content for textareas and contenteditable editors, and reports failure so the UI can fall back to the clipboard.
- **UI (`ui.ts`):** review dialog, status badge and toast inside a closed shadow root; user text is inserted only with `textContent`.
- **Storage:** settings in `chrome.storage.local` (the synced store would upload custom words to Google). The token mapping lives only in content-script memory and is gone on reload or tab close.
- **Send handling:** MaskIT blocks the send, masks the box on approval, and the user presses send themselves. It never programmatically clicks send, because that is fragile across editors.
- **Build:** `scripts/build.mjs` (esbuild) outputs `dist/` as plain scripts that Chrome can load unpacked.

## 5. File masking (planned)
Parsers extract text per format (TXT, CSV/XLSX, DOCX, PDF via pdf.js, OCR via tesseract.js for scans), run the engine in a Web Worker, and write the masked output in the same format where possible.

## 6. Privacy invariants
1. No network calls during analysis or masking (enforced by an automated test).
2. No telemetry.
3. Mapping never written to persistent storage unless the user opts in, and then it is encrypted.
4. Extension permissions limited to supported AI sites and storage.

## 7. Performance targets (planned)
- Pattern-only analysis of 100 KB text in under 200 ms.
- Analysis runs in a worker so the page never freezes.
- NER model loads lazily.
