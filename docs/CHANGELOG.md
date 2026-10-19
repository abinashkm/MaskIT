# Change Log

Every change is recorded here: **what** changed, **where** it lives, and **how it works**. Newest first. Update this in the same commit as the change.

## Entry template
```
### YYYY-MM-DD: short title
- **What:** one-line summary of the change.
- **Where:** files / packages touched.
- **How it works:** plain-language explanation, including any non-obvious logic.
- **Why:** reason (link to DECISIONS.md entry if one exists).
- **Tests:** what covers it.
- **Docs updated:** which docs changed.
```

---

### 2026-10-19: Accuracy benchmark, and six recognizer fixes it exposed (start of Phase 4)
- **What:** A reproducible benchmark that scores every entity type for precision and recall, measures false positives on ordinary text, and lists known gaps. Its first run found real bugs, which are fixed.
- **Where:**
  - New package `packages/bench/` (`src/rng.ts` seeded generator, `src/generators.ts` labeled cases, `src/evaluate.ts` scoring, `src/report.ts` markdown writer, `test/bench.test.ts` CI guard). Output: `docs/BENCHMARKS.md` (generated, do not edit by hand).
  - Fixes in `packages/core/src/resolver.ts`, `recognizers/contact.ts`, `recognizers/network.ts`; new tests in `packages/core/test/recognizers.test.ts` ("benchmark regressions").
- **How the benchmark works:** 200 generated sentences per entity type (19 types) with the labeled value's position recorded; card, IBAN and routing numbers get valid checksums; the seed is fixed so results are identical every run. A finding counts as correct when the type matches and the span overlaps the label with IoU of at least 0.5. "Masked at all" ignores the label and asks only whether the value was covered, which is what matters for privacy. 450 lines of ordinary text (code, version numbers, invoice and order numbers, times, hashes, UUIDs, SQL, prose) measure false positives per level. A separate "known gaps" set (unlabeled names, bare SSN digits, unlabeled DOB, non-US addresses, bare phone digits) shows what the rules are not expected to catch. `pnpm --filter @maskit/bench bench` regenerates the report.
- **First run (before fixes):** overall precision 96.1%, recall 96.1%. Per type: IP address recall 38.5%, IBAN recall 88.5%, phone precision 61.7%, credit card precision 89.7%. On ordinary text: 6.9% of lines wrongly flagged at standard, 13.6% at strict.
- **Bugs found and fixed:**
  1. **IBAN lost to credit card.** A run of digits inside an IBAN passes the Luhn check by chance about 1 time in 10, and the card priority beat the IBAN, so the IBAN was missed. IBAN priority is now above credit card (mod-97 is a much stronger check).
  2. **IP and MAC addresses labeled as phone numbers.** The phone pattern matched `38.26.148.177` and `53-29-26-68-07-58`, and phone priority beat them. The phone recognizer now skips valid IPv4 and MAC shapes, and IP/MAC priority is above phone.
  3. **Names ran into the next sentence** ("Priya Khan Thanks"). A name now stops at words that start a new clause or field (Thanks, Please, Phone, DOB and similar).
  4. **Version numbers read as IP addresses** ("Version 7.5.3.7"). An IPv4-shaped string right after "version", "v", "release", "build" and similar is now ignored.
  5. **Order, invoice, tracking and ticket numbers read as phones** at the strict level. A bare digit run right after such a label is now ignored unless a phone word is also nearby.
  6. **UUID fragments read as phones** ("89268724-1506-..."). A phone candidate may no longer be immediately followed by a hyphen and another character.
- **After fixes:** 100% on the synthetic set and no false positives on the ordinary-text lines. This is a result of tuning against the same data, so it shows "no known regressions", not real-world accuracy. The report says so at the top.
- **Why:** Plans promised published precision and recall; finding bugs before users do (D-018).
- **Tests:** 23 benchmark tests: per-type floors (precision and recall at least 95%, masked-at-all at least 99%), overall at least 97%, at most 2% false positives on ordinary text, and a check that `docs/BENCHMARKS.md` matches a fresh run (so a recognizer change cannot be committed without refreshing the numbers). Six regression tests in core for the bugs above. Total across the repo: 122 tests.
- **Docs updated:** CHANGELOG, PLAN, MAINTENANCE, DECISIONS (D-018), ARCHITECTURE, USER_GUIDE, INTERVIEW_GUIDE, docs/README, new docs/BENCHMARKS.md.

### 2026-10-19: File masking (Phase 3)
- **What:** Mask files, not just pasted text: TXT, MD, LOG, JSON, CSV, TSV, DOCX, and PDF (as text). New "Mask a file" panel in the web app with summary, warnings, preview and download.
- **Where:**
  - New package `packages/files/` (`src/index.ts` dispatch, `docx.ts`, `csv.ts`, `mask.ts`, `types.ts`; tests in `test/files.test.ts`).
  - `packages/web/src/FilePanel.tsx`, `packages/web/src/pdf.ts` (PDF text extraction with pdf.js), `packages/web/test/pdf.test.ts`, small edits to `App.tsx`, `styles.css`, `vite.config.ts`.
  - `packages/core/src/index.ts` now also exports `enabledEntityTypes`.
- **How it works:**
  1. `maskFile(name, bytes, options)` picks a handler by extension and returns the masked bytes, a count per entity type, warnings, and a text preview. Everything runs in memory in the browser tab.
  2. **Text files:** masked as one string with the shared `MaskSession`, so tokens match the rest of the app and the Restore box works for files too.
  3. **CSV/TSV:** parsed with a quote-aware parser (delimiter auto-detected, CRLF and byte order mark handled), each cell is masked on its own. Column headers add context: a cell under "Name", "DOB", "SSN", "Email" and similar is masked as that type even if the value alone looks harmless, but only if the chosen level includes that type. The header row stays readable.
  4. **DOCX:** the file is unzipped (with a total-size guard) and each text part (`document`, headers, footers, footnotes, endnotes, comments) is processed paragraph by paragraph. Text in Word is split into many runs, so the runs of a paragraph are joined, scanned as one string, and each replacement is written back into the run where the finding starts (the rest of the finding is removed from later runs). Tracked-deletion text (`w:delText`) is masked too because it still holds the original. Comment author names are replaced with "Author", and document properties (creator, last modified by, title, subject, description, keywords, Company, Manager) are blanked. Other files in the archive are copied unchanged.
  5. **PDF:** pdf.js (loaded only when a PDF is chosen, with `isEvalSupported: false`) extracts the selectable text, which is then masked as plain text and offered as `.masked.txt`. The layout, images and metadata are not carried over. A PDF with no selectable text (a scan) is refused with a clear message because OCR is not built yet **(planned)**.
  6. Limits: 25 MB per file; DOCX contents may not expand beyond 100 MB.
- **Why:** The plan promised document masking (D-016, D-017).
- **Tests:** 17 tests in `packages/files` (CSV parsing and quoting, header hints and level respect, delimiters, byte order mark and a CSV that merely starts with the letters "FEFF", DOCX text split across runs, tracked deletions, XML entities, untouched paragraphs, metadata and reviewer-name removal, other files kept, restore through the shared session, invalid files, size limit) plus 2 for PDF line assembly. The pdf.js calls were checked once in Node against a hand-made PDF.
- **Not verified:** The file panel and PDF worker have not been exercised in a real browser (drag and drop, download, worker loading under the page's security policy). Real Word documents from Word, Google Docs and LibreOffice have not been tried; only a minimal hand-built DOCX is in the tests. Spreadsheets (`.xlsx`) are not supported yet **(planned)**.
- **Docs updated:** CHANGELOG, PLAN, ARCHITECTURE, MAINTENANCE, USER_GUIDE, THREAT_MODEL, DECISIONS (D-016, D-017), INTERVIEW_GUIDE, docs/README.

### 2026-10-18: Chrome extension (Phase 2)
- **What:** A Manifest V3 extension that checks your prompt for sensitive data when you press Enter or click Send on ChatGPT, Claude or Gemini, and lets you review and mask it first. A toolbar popup holds settings and a "restore AI reply" tool.
- **Where:** `packages/extension/`: `manifest.json`, `popup.html/css`, `scripts/build.mjs`, and in `src/`: `content.ts` (wiring), `adapters.ts` (per-site selectors), `editor.ts` (read/write the prompt box), `guard.ts` (what interrupts a send, one-shot bypass), `ui.ts` (review dialog, badge, toast), `settings.ts`, `messages.ts`, `popup.ts`. Tests in `test/extension.test.ts` and `test/privacy.test.ts`. Also `packages/web/tsconfig.json` and `eslint.config.js` adjusted.
- **How it works:**
  1. `content.ts` runs only on the four listed hosts. It listens for Enter keydown (in the prompt box) and clicks on the send button, in the capture phase so it runs before the site's own handlers.
  2. `guard.evaluate()` runs the core engine on the prompt text using the saved level and custom words. If nothing is found, the send goes through untouched.
  3. If something is found, the send is blocked and a review dialog (in a closed shadow DOM) lists each item with a checkbox. Choices: **Mask selected** (replaces the box content with tokens and lets the user check before sending), **Send without masking** (allows exactly one send within 10 seconds), **Cancel**.
  4. `editor.writeText()` replaces content in a way rich editors notice (native value setter for textareas, `execCommand("insertText")` for contenteditable). If the editor does not end up with the expected text, the masked text is copied to the clipboard and the user is told.
  5. The token mapping stays in the content script's memory (isolated from the page's scripts) and disappears on reload or tab close. The popup asks the content script to restore text via messages, so the mapping never moves.
  6. A small badge shows "MaskIT on", "MaskIT off" or "MaskIT: prompt box not found", so a broken adapter is visible instead of silently unprotected.
  7. Settings are stored in `chrome.storage.local`, never the synced store.
  8. `scripts/build.mjs` bundles with esbuild into plain scripts (`dist/content.js`, `dist/popup.js`) plus the manifest and popup files.
- **Why:** The product's main surface (D-004, D-005, D-009, D-014).
- **Tests:** 23 extension tests: host matching (look-alike domains rejected), selector helpers, textarea and rich-editor writes (including failure and whitespace-only differences), guard filtering by level and custom words, bypass is one-shot and expires, settings validation, and privacy invariants (source has no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, synced storage or `innerHTML`; manifest asks only for `storage` and the four AI hosts; extension pages cannot connect to the network).
- **Not verified:** The site selectors and the editor write path are written from knowledge of these sites and tested only against mocked DOM. They have **not** been tried on the live sites. Expect to adjust `adapters.ts` after the first real test.
- **Docs updated:** CHANGELOG, PLAN, ARCHITECTURE, MAINTENANCE, USER_GUIDE, THREAT_MODEL, DECISIONS (D-014, D-015), INTERVIEW_GUIDE, docs/README.

### 2026-10-18: Web demo app (completes Phase 1 MVP)
- **What:** A static React page where you paste text, pick a level and style, review each finding, copy the masked text, and restore an AI reply locally.
- **Where:** `packages/web/` (`index.html`, `vite.config.ts`, `src/App.tsx`, `src/main.tsx`, `src/styles.css`).
- **How it works:**
  1. `App.tsx` calls `analyze()` from `@maskit/core` on every edit (level, text, custom words).
  2. Each finding is a checkbox; unticked findings are kept out of the masked output. `applyMask()` masks only the approved ones.
  3. A single `MaskSession` lives in React state (memory only). "Restore" runs `restoreText()` on a pasted reply; "Clear mapping" wipes the session.
  4. Vite aliases `@maskit/core` to the core source, so `pnpm --filter @maskit/web dev` needs no prior core build.
  5. A Content-Security-Policy (`connect-src 'none'`, no remote scripts) is injected into the production `index.html` at build time only, so the built page cannot make network requests. It is not injected in dev because Vite's dev helpers need inline scripts.
- **Why:** A demoable, installation-free surface for the engine and the privacy claim (D-001, D-013).
- **Tests:** Engine logic is covered by the 51 core tests. The UI has no automated tests yet **(planned: Playwright E2E)**; it was verified to typecheck, lint and build, but not yet checked by hand in a browser.
- **Docs updated:** CHANGELOG, PLAN, ARCHITECTURE, MAINTENANCE, USER_GUIDE, DECISIONS (D-013), docs/README.

### 2026-10-18: Core masking engine (Phase 0 scaffold + Phase 1 engine)
- **What:** Monorepo scaffold and the first working `@maskit/core` engine: 19 recognizers, four masking levels, overlap resolution, reversible token masking with restore, and custom deny-list terms.
- **Where:**
  - Tooling: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.gitattributes`, `LICENSE`, `.github/workflows/ci.yml`.
  - Engine: `packages/core/src/` with `types.ts`, `levels.ts`, `validators.ts`, `resolver.ts`, `analyzer.ts`, `masker.ts`, `index.ts` and `recognizers/` (`contact`, `financial`, `identity`, `secrets`, `network`, `custom`).
  - Tests: `packages/core/test/recognizers.test.ts`, `engine.test.ts` (51 tests).
- **How it works:**
  1. `analyze(text, options)` runs each recognizer whose entity types are enabled by the level, drops findings below the level's minimum confidence, then `resolve()` removes overlaps (entity priority, then confidence, then longer span).
  2. Structured data is validated, not just pattern-matched: Luhn (cards), mod-97 (IBAN), ABA checksum (routing), SSN structure rules, IP octet ranges, real calendar day/month.
  3. Ambiguous data needs context: nine bare digits are an SSN only after "SSN"; a date is a date of birth only after "DOB/born"; bare 10-digit runs are phones only after "phone/tel/mobile".
  4. `maskText()` swaps each finding for a token like `[EMAIL_1]` through a `MaskSession`. The same value (normalized, so `A@X.COM` equals `a@x.com` and phone formats are ignored) always gets the same token. `restoreText()` reverses tokens locally. `style: "redact"` gives irreversible `[REDACTED]`.
  5. Levels: basic (min confidence 0.8: contact, financial, secrets), standard (0.5, adds names, addresses, DOB, health IDs, network IDs), strict (0.3, adds all dates, ages over 89; organization/location wait for NER), custom (caller picks types).
  6. Names are detected only after labels or titles ("Patient:", "Dr.") until the NER layer exists **(planned)**.
- **Why:** Establish the core of the product first; every front-end depends on it (D-002, D-003, D-004, D-011, D-012).
- **Tests:** Per-recognizer positive, negative and near-miss cases; level behavior; token reuse; restore round-trip; resolver priority; 130 KB input under 2 s; a test that fails if `fetch` is called; false-positive checks on code and ordinary prose. Fake secrets in tests are built by string concatenation so secret scanners do not flag the repo.
- **Docs updated:** CHANGELOG, ARCHITECTURE, MAINTENANCE, DECISIONS (D-011, D-012), PLAN (progress), INTERVIEW_GUIDE (section 10), docs/README.

### 2026-10-18: Docs-update enforcement added
- **What:** A pre-commit hook and a PR template that force docs to be updated alongside changes.
- **Where:** `.githooks/pre-commit`, `.github/pull_request_template.md`, `docs/MAINTENANCE.md` (section 2), `CLAUDE.md`.
- **How it works:** The hook lists staged files; if any are not docs or markdown and `docs/CHANGELOG.md` is not staged, the commit fails with instructions. It is activated per clone with `git config core.hooksPath .githooks` (already set in this clone). The PR template adds a docs checklist.
- **Why:** Docs go stale unless something checks them (see D-010).
- **Tests:** Verified manually: a commit with code but no changelog is rejected, and one with both passes.
- **Docs updated:** MAINTENANCE, CHANGELOG, DECISIONS (D-010).

### 2026-10-18: Documentation suite created
- **What:** Added the full docs set: plan, architecture, decisions, maintenance, user guide, threat model, glossary, interview guide, and this change log.
- **Where:** `docs/` (all files), `CLAUDE.md` at repo root.
- **How it works:** `docs/README.md` is the index. `CLAUDE.md` tells the AI assistant to keep the change log and decisions current on every change.
- **Why:** Keep the project understandable for the owner, users and interviewers from day one.
- **Tests:** n/a (documentation).
- **Docs updated:** all of them (initial versions).

### 2026-10-18: Project plan written, old README removed
- **What:** Removed the unrelated placeholder `README.md` (it described a different project). Added the MaskIT plan, then moved it into `docs/`.
- **Where:** `docs/PLAN.md` (originally `PLAN.md` at root).
- **How it works:** The plan defines vision, coverage, detection pipeline, masking levels, architecture, security, testing, roadmap and risks.
- **Why:** Decide the product direction before writing code.
- **Tests:** n/a.
- **Docs updated:** PLAN.md.
