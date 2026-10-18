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
packages/extension/  Manifest V3 extension (content script, service worker, popup)
packages/web/        static web app (React + Vite)
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

## 4. Chrome extension (planned)
- **Content script:** attached to supported AI sites through per-site adapters. Intercepts paste and send, calls the engine, shows the review overlay.
- **Service worker:** settings and lifecycle only. No network.
- **Popup:** level selector, category toggles, custom rules.
- **Site adapters:** one small module per site holding its DOM selectors, so breakage is isolated and easy to fix.
- **Storage:** settings in `chrome.storage.sync`; mapping in `chrome.storage.session` (cleared when browser closes).

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
