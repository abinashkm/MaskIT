# MaskIT: Project Plan

## 1. Vision
MaskIT is a free, open-source, **local-first redaction tool for PII, PHI, financial data and secrets**. Users mask sensitive content in text and documents *before* sending it to AI tools. It ships as a Chrome extension, a standalone web page and a reusable core library.

**Core promise:** all processing happens on the client. No backend, no telemetry, no remote model calls. Portfolio-level project, free to use.

## 2. Goals and non-goals

**Goals**
- Detect and mask PII, PHI (HIPAA's 18 identifiers), financial data, secrets and network/device identifiers.
- Let users choose a masking level and review findings before sending.
- Reversible masking, so an AI reply can be unmasked locally.
- Publish measurable accuracy (precision and recall per category).
- Provable privacy: open source, minimal permissions, zero-network test.

**Non-goals**
- No server, accounts or cloud sync.
- No claim of legal compliance ("HIPAA compliant"). Wording is "supports HIPAA Safe Harbor-style de-identification".
- No guarantee of 100% detection. The UI always allows review.

## 3. Coverage

| Group | Examples | Maps to |
|---|---|---|
| Direct identifiers | Names, emails, phones, addresses, national IDs/SSN, passport, driver's licence, DOB | GDPR, CCPA, HIPAA |
| PHI | MRN, health plan IDs, diagnosis context, device IDs, care-related dates | HIPAA 18 identifiers |
| Financial | Cards (Luhn), IBAN (mod-97), bank accounts, routing numbers, SWIFT | PCI-DSS |
| Secrets | API keys, JWTs, private keys, passwords, connection strings | OWASP, secret scanners |
| Network/device | IPs, MACs, URLs with tokens, GPS coordinates | GDPR |
| Free-text entities | Person, organization, location names | NER |

## 4. Detection pipeline (all local)
1. **Pattern recognizers:** regex plus checksum validation (Luhn, IBAN mod-97, SSN rules) to cut false positives.
2. **Context scoring:** nearby keywords ("Patient:", "DOB:", "MRN") raise or lower confidence (Presidio-style).
3. **On-device NER (optional, built):** quantized DistilBERT model (about 66 MB) via transformers.js, in a Web Worker (web app) or an offscreen page (extension), for names, organizations and locations. Packaged with the app, with no runtime network calls (see ARCHITECTURE.md section 4).

Each finding has: `type`, `start/end span`, `confidence`, `recognizer id`. Overlaps are resolved by priority and confidence.

## 5. Masking levels
- **Basic:** high-confidence identifiers and secrets.
- **Standard (default):** Basic plus names, addresses, DOB.
- **Strict / Safe Harbor:** adds all dates, sub-state locations, organizations, ages over 89.
- **Custom:** per-category toggles, user regex and deny-list terms.

## 6. Masking style and reversibility
- **Consistent tokens** such as `[PERSON_1]`, `[EMAIL_2]`. The same value gives the same token within a session.
- Alternate modes: full redaction, generalization (date to year), synthetic replacement.
- The token-to-value map is kept in memory or encrypted `chrome.storage.session` and cleared when the tab closes. Persistent storage is opt-in and WebCrypto-encrypted.
- A "Restore" action unmasks AI replies locally.

## 7. Product surfaces
1. **Chrome extension (Manifest V3):** content script on ChatGPT, Claude, Gemini and similar. Intercepts paste and send, shows "N sensitive items found", and masks on approval. Popup for settings.
2. **File masking:** TXT, DOCX, PDF (pdf.js), CSV/XLSX. Optional OCR (tesseract.js) for scans, built (web app). Name and OCR engines run in workers; file masking itself still runs on the main thread **(planned: worker)**.
3. **Standalone web app:** static site using the same engine, usable as a portfolio demo without installing anything.
4. **CLI (later):** the same engine for batch use.

## 8. Architecture
Monorepo (pnpm workspaces):

```
packages/
  core/        # detection + masking engine, TypeScript, no DOM dependency
  extension/   # MV3 extension (content script, service worker, popup)
  web/         # static web app (React + Vite)
  cli/         # later
docs/          # threat model, benchmarks, limitations
```

Stack: TypeScript, Vite, React, Vitest, Playwright, ESLint/Prettier, GitHub Actions.

## 9. Security and privacy
- Strict CSP, no `eval`, no remote code.
- Minimal permissions: host access only to supported AI sites, plus `storage`.
- Automated test that fails if any network request is made during masking.
- Threat model in `docs/`: malicious pages, DOM scraping, mapping-store leakage, supply chain.
- Pinned dependencies, lockfile, reproducible builds, signed releases.
- MIT license and public source.

## 10. Quality and testing
- Unit tests per recognizer (positive, negative, edge cases).
- Checksum validators tested with known valid/invalid values.
- False-positive tests on source code, logs and prose.
- Benchmarks against synthetic labeled PII/PHI datasets, with precision/recall per category published in `docs/benchmarks.md`.
- E2E tests (Playwright) for the extension on mocked chat pages.
- Public limitations page.

## 11. Roadmap

| Phase | Scope | Done when |
|---|---|---|
| **0. Setup** | Monorepo, tooling, CI, license, README | CI green on empty packages |
| **1. MVP** | Core engine: email, phone, SSN, card, IBAN, IP, secrets recognizers; Basic/Standard levels; token masking; web page for pasted text | Tests pass; demo page masks and restores text |
| **2. v1** | Chrome extension on major AI sites; review UI; Strict and Custom levels; reversible tokens in session storage | Works on 3+ AI sites; E2E tests pass |
| **3. v1.5** | File masking: DOCX, PDF, CSV/XLSX | Masked files downloadable; fixtures pass |
| **4. v2** | NER model, OCR, benchmarks, local audit log, Chrome Web Store listing | Published benchmarks; store submission |

## 11a. Progress
| Phase | Status |
|---|---|
| 0. Setup | Done: monorepo, TypeScript, Vitest, ESLint, Prettier, CI workflow, MIT license |
| 1. MVP | Done: engine, web app, restore |
| 2. Extension | Done and tested in real Chromium on mock pages with real editor libraries; spot-checked on the real logged-out Gemini and ChatGPT pages. **Open:** signed-in checks, Claude (blocked by a Cloudflare challenge for automated browsers) |
| 3. Files | Done: text, CSV/TSV, DOCX, XLSX, PDF (as text), scanned PDF and images through OCR. **Open:** real-world Office files from Word, Excel, Google and LibreOffice |
| 4. Accuracy and publishing | Done: generated and hand-written benchmarks (with CI guards), on-device name model in the web app, files and extension, OCR, icons, privacy policy, store listing draft, CI browser job. **Open:** real-document test set, Chrome Web Store submission (owner), CLI, per-finding review for files, moving file masking into a worker, non-English support |

Details of each change are in [CHANGELOG.md](CHANGELOG.md). What is left, in order of value:
1. Check the extension signed in on ChatGPT, Gemini and Claude (MAINTENANCE.md 4a) and fix selectors.
2. Check real Office files and phone photos (MAINTENANCE.md 5b).
3. Build a small hand-labeled set of real, consented documents to measure real accuracy.
4. Submit to the Chrome Web Store (docs/STORE_LISTING.md).
5. Nice to have: CLI, a per-finding review step for files, a worker for big files, other languages.

## 12. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Client-side NER less accurate and heavy (30-100 MB) | Optional; rules layer works alone; measured: about 66 MB, English only, see BENCHMARKS-NER.md |
| AI site DOM changes break the extension | Isolate selectors in one adapter per site; E2E tests; fallback to a paste-in box |
| False negatives give users false confidence | Mandatory review UI, clear limitations, published recall numbers |
| Legal wording overreach | No compliance claims; document what is covered |
| Store review delays | Minimal permissions; clear privacy policy |

## 13. Open questions (decide when reached)
- Which NER model gives the best accuracy per MB. (Decided for now: DistilBERT NER int8, D-020; a multilingual PII model is the next candidate.)
- Whether to support Firefox/Edge at v1 or after.
- Whether to add multi-language PII patterns (non-US IDs, phone formats) in v1 or v2.

## 14. Immediate next steps
1. Scaffold the monorepo and CI (Phase 0).
2. Implement the recognizer interface and first recognizers with tests (Phase 1).
3. Build the minimal web page to demo masking and restoring.
