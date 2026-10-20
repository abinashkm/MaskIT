# Decision Log

Short records of choices and their reasoning. Add a new entry whenever a non-obvious choice is made. Never delete old ones; mark them **Superseded** and link the new one.

Format: **Context -> Decision -> Alternatives -> Consequences.**

---

## D-001: Fully client-side, no backend
- **Context:** The product handles the most sensitive data users have.
- **Decision:** All processing runs in the browser. No server, no telemetry.
- **Alternatives:** Server-side ML (more accurate, but users must trust us with raw data); hybrid (still sends data out).
- **Consequences:** Strongest privacy story and zero hosting cost. Accuracy limited by on-device models; no central analytics.

## D-002: Shared core engine, thin front-ends
- **Context:** Extension, web app and CLI all need the same detection.
- **Decision:** One `core` package with no DOM dependency; front-ends only do UI and I/O.
- **Alternatives:** Duplicate logic per surface; extension-only codebase.
- **Consequences:** One place to test and benchmark; easy to publish as a library. Requires discipline to keep UI out of core.

## D-003: Layered detection (patterns, context, optional NER)
- **Context:** Regex alone misses names; ML alone is heavy and opaque.
- **Decision:** Validated patterns first, context scoring second, optional on-device NER third.
- **Alternatives:** Regex only (misses free-text names); NER only (heavy, slow, weaker on structured IDs).
- **Consequences:** Useful with zero model download; accuracy improves when NER is enabled.

## D-004: Reversible consistent tokens as the default mask
- **Context:** Plain redaction destroys context the AI needs and cannot be undone.
- **Decision:** Replace values with tokens like `[PERSON_1]`; same value gives same token; keep a local mapping to restore AI replies.
- **Alternatives:** Black-box redaction (loses context); synthetic data only (hard to reverse reliably).
- **Consequences:** Better AI answers and a unique restore feature. The mapping becomes sensitive data and needs careful storage (see D-005).

## D-005: Mapping lives in session memory by default
- **Context:** The mapping contains the real values.
- **Decision:** Hold it in memory / `chrome.storage.session`; clear on browser close. Persistence is opt-in and encrypted with WebCrypto.
- **Alternatives:** Always persist (convenient but risky); never keep (no restore).
- **Consequences:** Safe default; users who want persistence must opt in.

## D-006: Four masking levels
- **Context:** Different users need different strictness.
- **Decision:** Basic, Standard (default), Strict (HIPAA Safe Harbor-style), Custom.
- **Alternatives:** Single mode; fully manual per-category only.
- **Consequences:** Simple for most users, flexible for power users.

## D-007: TypeScript monorepo (pnpm workspaces)
- **Context:** Several packages share a core library.
- **Decision:** pnpm workspaces, TypeScript, Vite, Vitest, Playwright.
- **Alternatives:** Separate repos; plain JavaScript.
- **Consequences:** Type-safe shared code and a single CI pipeline.

## D-008: No compliance claims
- **Context:** "HIPAA compliant" is a legal status, not a software feature.
- **Decision:** Say "supports HIPAA Safe Harbor-style de-identification" and document limits.
- **Consequences:** Honest positioning; avoids legal exposure.

## D-009: Per-site adapters for AI websites
- **Context:** AI sites change their DOM often.
- **Decision:** Isolate selectors in one adapter module per site, with a paste-in box fallback.
- **Consequences:** Breakage is local and quick to fix.

## D-010: Documentation maintained with every change
- **Context:** Solo portfolio project that must be explainable later.
- **Decision:** Update CHANGELOG (and DECISIONS where relevant) in the same commit as code. `CLAUDE.md` instructs the AI assistant to do this.
- **Enforcement:** A pre-commit hook rejects code commits without a CHANGELOG change; a PR template carries a docs checklist; a CI check is planned. Instructions alone were not trusted to keep docs current.
- **Consequences:** Docs stay accurate; small overhead per commit. The hook is local, so it can be bypassed with `--no-verify`.

## D-011: Priority-based overlap resolution and context-gated ambiguous data
- **Context:** Several recognizers can match the same text (a 16-digit run looks like a phone and a card). Some formats (nine digits, plain dates) are common in non-sensitive text.
- **Decision:** Resolve overlaps by entity priority (validated, specific types win), then confidence, then span length. Ambiguous formats only count with nearby context words, or at low confidence that only strict levels accept.
- **Alternatives:** Always keep the highest confidence (hard to reason about, unstable when scores are tuned); mask everything ambiguous (too many false positives, unusable output).
- **Consequences:** Predictable behavior that is easy to test and explain. Priorities live in one table (`resolver.ts`) and must be updated when a new entity type is added.

## D-012: Names detected by labels until NER ships
- **Context:** Names are the most common PII in free text, but the NER model is a later phase and is optional.
- **Decision:** Detect names after labels and titles ("Patient:", "Dr.", "Dear") with confidence 0.7, so the rules-only build still catches the most common cases.
- **Alternatives:** Skip names until NER (leaves an obvious gap); capitalized-word heuristics (too many false positives).
- **Consequences:** Names with no label are missed until the NER layer is added. This limitation is stated in the user guide.

## D-013: CSP injected at build time only, core consumed from source in dev
- **Context:** The web page must prove it makes no network calls, but Vite's dev server needs inline scripts that a strict CSP would block.
- **Decision:** A small Vite plugin adds the CSP meta tag (`connect-src 'none'`) only for production builds. In dev, the web app aliases `@maskit/core` straight to its TypeScript source.
- **Alternatives:** Always-on CSP (breaks dev hot reload); no CSP (weaker privacy guarantee).
- **Consequences:** Dev and production differ slightly, so the production build must be checked before release. No core build step is needed to run the app in dev.

## D-014: Block the send, mask on approval, and let the user press send
- **Context:** Automatically re-triggering the site's send action after masking is fragile: each site (ProseMirror, Quill) handles synthetic events differently.
- **Decision:** Intercept Enter and Send in the capture phase. On approval, replace the box content and stop; the user checks the result and sends. "Send without masking" allows one send within 10 seconds.
- **Alternatives:** Auto-send after masking (breaks when sites change); mask on paste only (misses typed content).
- **Consequences:** One extra keypress, but far fewer ways to break and the user always sees the masked text before it leaves.

## D-015: No service worker, no synced storage, mapping in content-script memory
- **Context:** Custom words and the token mapping are sensitive. The content script runs in an isolated world the page cannot read.
- **Decision:** Keep the mapping in content-script memory, save settings in `chrome.storage.local`, and skip a service worker until something needs it. The popup reaches the mapping through messages.
- **Alternatives:** `chrome.storage.session` (needs a worker to open access to content scripts); `chrome.storage.sync` (uploads to Google).
- **Consequences:** The mapping is lost on page reload, so Restore only works in the same page session. Persistent history is a possible opt-in feature later.

## D-016: DOCX masked per paragraph across runs, with metadata cleaned
- **Context:** Word splits one sentence into many runs (`<w:t>` elements), so scanning run by run misses values like an email broken in two. A masked file that still carries the author name, comments or deleted text would leak.
- **Decision:** Join the runs of each paragraph, scan once, and write each replacement into the run where the finding starts. Also mask `w:delText`, comments, headers, footers, footnotes and endnotes; replace reviewer names; blank core and app properties; copy everything else unchanged.
- **Alternatives:** Convert DOCX to text and back (loses formatting); run-by-run masking (misses split values); a full DOCX library (heavy, and still needs the same run handling).
- **Consequences:** Formatting is preserved and the common leak routes are closed. Text inside images, text boxes that nest paragraphs, and embedded objects is not guaranteed to be handled; images are reported as a warning.

## D-017: PDF is read with pdf.js and masked as plain text
- **Context:** Truly redacting a PDF in place means editing its drawing instructions and removing the hidden text layer; doing that badly leaves the original text extractable.
- **Decision:** Extract the selectable text with pdf.js (loaded on demand, no `eval`) and offer a masked `.txt`. Scanned PDFs are refused until OCR exists.
- **Alternatives:** Draw black boxes over text (the text remains underneath, a classic leak); rebuild a PDF from masked text (possible later, adds a PDF writer).
- **Consequences:** Safe and simple, but layout and images are lost, which the UI states. The PDF engine adds a large lazily loaded chunk.

## D-018: Synthetic, seeded benchmark with CI floors and a generated report
- **Context:** Accuracy claims need numbers, but real labeled PII is itself sensitive and I have none.
- **Decision:** Generate labeled cases from a fixed seed (valid checksums, random surrounding text), score per entity type, include ordinary-text negatives and a separate known-gaps set, and make the report a generated file that a test compares with a fresh run.
- **Alternatives:** Hand-written examples only (small and biased); public datasets (not available offline here, and real-world style differs per domain); no benchmark (claims would be unsupported).
- **Consequences:** Cheap, reproducible, a real regression guard, and it already found six bugs. It is optimistic by construction, and tuning against it makes the score look perfect, so the report states that prominently. A second, hand-labeled real-world set is the next step for honest accuracy numbers.

## D-019: A pluggable asynchronous Detector in core
- **Context:** A model runs asynchronously (and in different places per front-end), but the engine's recognizers are synchronous and pure.
- **Decision:** Keep `analyze()` synchronous and unchanged. Add a `Detector` interface and `analyzeAsync()`, which merges detector findings with recognizer findings *before* the level, confidence and overlap steps. A failing detector is skipped.
- **Alternatives:** Make everything asynchronous (breaks simple callers and tests); let the model bypass the pipeline (it would ignore levels and overlap rules).
- **Consequences:** One set of rules governs every source of findings. Callers that want the model use the async path; file masking became asynchronous.

## D-020: English DistilBERT NER (8-bit) with generic plausibility filters
- **Context:** Rules cannot find names without a label. Candidates: a 14 MB TinyBERT (unknown licence and quality), a 66 MB DistilBERT NER (Apache-2.0 base), a 109 MB BERT NER, a 279 MB multilingual PII model (MIT).
- **Decision:** Ship `onnx-community/distilbert-NER-ONNX` int8. Add sanity filters for known model habits (greetings, sentence-opening verbs, short all-caps codes, lowercase starts, dotted initials).
- **Alternatives:** The multilingual PII model (better coverage, four times the size); a bigger BERT (slower, larger); name lists (cheap, but common words are names).
- **Consequences:** English only, news-style training data, about 66 MB. The filters were tuned after looking at this model's mistakes on the hand-written set, so reported numbers are somewhat optimistic. Swapping the model means changing one constant and re-running the NER benchmark.

## D-021: Model as a packaged static file, never fetched at run time; same-origin policy in the web app
- **Context:** "Nothing leaves your device" must hold for the model download too.
- **Decision:** A developer/build step downloads the model once (`fetch-model`). The web app serves it from its own origin and its Content-Security-Policy changes from `connect-src 'none'` to `'self'` (plus `wasm-unsafe-eval` for WebAssembly, still no `unsafe-eval`). The extension packages the model inside itself and its extension-page policy is `connect-src 'self'`. Remote model loading is switched off in the library.
- **Alternatives:** Load from a CDN or the model hub at run time (simple, but breaks the privacy promise and the policy); ship the model in git (66 MB of binary history).
- **Consequences:** Larger deliverables (extension about 87 MB with the model), a build step that can run without the model (everything degrades to rules), and tests that assert no request leaves the site.

## D-022: Extension name model: offscreen page, background pre-check, hold-and-recheck
- **Context:** Extension service workers are short-lived and cannot host a large WebAssembly model; the content script must decide to block a send *synchronously*, but the model answers asynchronously.
- **Decision:** Host the model in an offscreen document created by the service worker (creation shared between tabs, requests retried until the page listens). The content script pre-checks the prompt 400 ms after typing stops and caches the result for that exact text. At send time it uses the cache; if there is none it holds the send, checks (8 s timeout, then rules only), and either shows the review dialog or repeats the send itself using a one-shot bypass and a click on the site's send button.
- **Alternatives:** Run the model inside each page (heavy, subject to the page's policy, one copy per tab); always hold every send (slow); never auto-send (extra keypress, but the held prompt would feel lost).
- **Consequences:** Most sends decide instantly; a quick send waits for the model. Re-sending uses the site's own button, which is another reason the badge and tests matter. This reverses part of D-014 only for the case where the model was needed and found nothing.

## D-023: OCR with tesseract.js, opt-in, English, output as masked text
- **Context:** Scans and screenshots hide personal data from every text rule.
- **Decision:** Optional OCR using tesseract.js with its worker, WebAssembly core and fast English data served from the page's own files. Scanned PDFs are drawn page by page onto canvases. The result is masked and offered as `.txt` with a warning that OCR can misread and that images are not carried over.
- **Alternatives:** Always on (slow, surprising); a cloud OCR service (breaks the privacy promise); black-box redaction drawn over the image (needs reliable word boxes and still leaves the image metadata).
- **Consequences:** English only, a few seconds per page, 4 MB data plus 4 MB engine, accuracy unmeasured on messy scans.

## D-024: Real-browser tests with real editor libraries, request interception, and non-CI spot checks of the live sites
- **Context:** Mock-DOM unit tests passed while real defects existed (focus after masking, token drift in the preview, first-use races, missing selectors).
- **Decision:** Playwright drives real Chromium. The extension runs unpacked against local pages built with ProseMirror and Quill, served at the real hostnames by intercepting requests. Live-site checks (logged out only) are done by hand with throwaway scripts and recorded in the CHANGELOG, not in CI, because the sites change, block automation (Cloudflare) and need accounts.
- **Alternatives:** Test only the real sites (flaky, needs accounts, can break CI at any time); mocks without real editors (misses editor behavior).
- **Consequences:** Strong regression protection for everything we control; selectors for the real sites still need periodic manual checks (MAINTENANCE.md 4a).

## D-025: One shared Office XML implementation for Word and Excel
- **Context:** Both formats split text over runs and carry personal data in metadata, comments and authors.
- **Decision:** `ooxml.ts` holds the run-joining, entity handling, unzip size guard and property cleanup; `docx.ts` and `xlsx.ts` only say where the text lives and what to anonymize. Numeric cells, sheet names and formulas in Excel are left alone and reported.
- **Alternatives:** A full spreadsheet library (heavy, rewrites the file); separate copies (the same bugs twice).
- **Consequences:** A fix to run handling helps both formats. A phone number typed as a number in Excel is not found, which the result states.
