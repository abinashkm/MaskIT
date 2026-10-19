# Interview Guide: MaskIT

Likely interview questions with easy-to-follow answers. Speak in your own words; the answers show the *thinking*, not a script. Update the "what is built" parts as the project progresses.

---

## 0. The 60-second pitch
> "MaskIT is a free, privacy-first tool that detects and masks PII, PHI, financial data and secrets before you send text or documents to AI tools. It's a Chrome extension plus a web app, built on a shared TypeScript engine. Everything runs in the browser, so sensitive data never leaves the user's machine. Users pick a masking level, review what was found, and can restore the AI's reply locally because the masks are reversible tokens."

**Structure to remember:** Problem -> Solution -> Why it's different -> How it's built -> What I'd do next.

---

## 1. Problem and motivation
**Q: Why did you build this?**
People paste contracts, medical notes and code with secrets into AI chatbots without thinking. Companies ban AI because of that risk. I wanted a tool that makes it safe to use AI, without asking users to trust yet another server.

**Q: Who is the user?**
Professionals handling sensitive text (healthcare staff, HR, support, developers) and anyone who wants a safety net before pasting into AI.

**Q: How is this different from existing tools?**
Enterprise DLP tools are paid, server-based and admin-controlled. Libraries like Presidio need a backend. MaskIT is free, fully client-side, usable by an individual, and reversible.

**Q: Why free?**
It's a portfolio project; the goal is to show engineering quality and be genuinely useful. Being open source also makes the privacy claim verifiable.

---

## 2. Product thinking
**Q: What are the masking levels and why?**
Basic, Standard, Strict and Custom. Different data needs different strictness. Strict follows HIPAA Safe Harbor-style rules (remove all 18 identifier types). Standard is the default because over-masking makes AI answers useless.

**Q: Why reversible tokens like `[PERSON_1]`?**
They keep context (the AI knows two different people are involved) and let me restore real values in the answer. Plain blackout loses meaning and can't be undone.

**Q: Why a review step instead of fully automatic?**
No detector is perfect. Review gives users control, catches false positives, and avoids a false sense of security.

**Q: What would you build next?**
Multi-language PII patterns, Firefox/Edge support, a better NER model, and a team policy file (shared custom rules).

---

## 3. Architecture and structure
**Q: Explain the architecture.**
A pure-TypeScript `core` package does detection and masking. The Chrome extension, web app and CLI are thin front-ends that call it. This keeps logic in one tested place.

**Q: Walk me through what happens when I paste text.**
1. Content script catches the paste. 2. Text goes to the engine (in a Web Worker). 3. Recognizers produce findings. 4. The resolver removes overlaps and filters by level. 5. UI shows highlights. 6. On approval, the masker swaps values for tokens and stores the mapping. 7. Masked text goes to the AI box. 8. Later, Restore uses the mapping on the reply.

**Q: Why a monorepo?**
Packages share the core library; one CI, one version of tests, easy refactors.

**Q: Why TypeScript?**
Shared types between engine and UIs prevent mismatches; good tooling for a library others might consume.

**Q: How do you handle AI sites changing their layout?**
Each site has its own small adapter file holding selectors. A change breaks one adapter, not the whole product, and a paste-in box is the fallback.

---

## 4. Detection and technical depth
**Q: How does detection work?**
Three layers. (1) Pattern recognizers with validation, (2) context scoring, (3) optional on-device NER for names/orgs/places.

**Q: Why not just regex?**
Regex handles structured data well but can't tell that "Jane met Raj at Apollo" contains two people and a hospital. Names need NER.

**Q: Why not just an ML model?**
Models are heavy, slower, and less reliable on exact formats like card numbers. Checksums give near-certainty for structured IDs.

**Q: What is Luhn and why use it?**
A check-digit algorithm used by card numbers. A random 16-digit number fails it ~90% of the time, so it removes most false positives.

**Q: How do you resolve overlapping matches?**
Priority of entity type, then confidence, then span length.

**Q: How do you measure accuracy?**
Labeled synthetic datasets, reporting precision and recall per category. I favor recall (missing data is worse than extra flags) but watch precision so the tool stays usable.

**Q: What are false positives vs false negatives here?**
False positive: harmless over-masking. False negative: sensitive data leaks. So I tune toward fewer false negatives and mitigate false positives with the review step.

**Q: How do you keep the UI from freezing on big documents?**
Run the engine in a Web Worker and process in chunks.

**Q: How do you handle PDFs and scans?**
pdf.js for text PDFs, optional tesseract.js OCR for scans, both in workers. OCR errors are a documented limitation.

---

## 5. Privacy and security
**Q: How can users trust it's really local?**
Open source, no backend, minimal extension permissions, and an automated test that fails if any network request happens during masking.

**Q: Where is the mapping stored? Isn't it sensitive?**
Yes. By default it's only in session memory/session storage and cleared when the browser closes. Persistence is opt-in and encrypted with WebCrypto. The page's JavaScript never gets access to it.

**Q: What if the AI site's scripts read the input before you mask?**
The masking happens at paste/send interception, and the mapping stays in the extension context. I documented the residual risk in the threat model instead of hiding it.

**Q: What about supply-chain attacks?**
Few dependencies, pinned versions with lockfile, audit in CI, manual review of updates, and strict CSP.

**Q: Can you say it's HIPAA compliant?**
No. Compliance is a legal status for an organization's whole process. I say it supports Safe Harbor-style de-identification and document its limits.

---

## 6. Testing and quality
**Q: How do you test this?**
Unit tests per recognizer (valid, invalid, near-miss, embedded), false-positive tests on code/logs/prose, Playwright E2E tests on mocked chat pages, a no-network test, and benchmark runs.

**Q: How do you stop regressions in accuracy?**
Benchmarks run in CI; a drop in recall or precision beyond a threshold fails the build.

**Q: How do you test without real sensitive data?**
Synthetic data generated from known formats and public test numbers (for example test card numbers).

---

## 7. Process and thinking
**Q: How did you plan the project?**
I started with the problem, defined goals and non-goals, chose the architecture, wrote risks, and split delivery into phases so each phase ships something usable (MVP is the engine plus a web page).

**Q: Biggest trade-offs?**
Privacy vs accuracy (client-side models are weaker), convenience vs safety (session-only mapping), and coverage vs maintenance (supporting many AI sites).

**Q: What decisions did you document and why?**
`DECISIONS.md` records each choice with alternatives and consequences, so future me (and reviewers) know the reasoning.

**Q: What would you do differently?**
Update this section honestly as the project evolves (for example "I'd start NER evaluation earlier").

**Q: What was hardest?**
Fill in as you go. Likely candidates: balancing false positives vs negatives, handling rich-text editors on AI sites, running NER within browser size limits.

**Q: How do you keep docs current?**
Rule: the change log is updated in the same commit as the code. The AI assistant is instructed to do this through `CLAUDE.md`.

---

## 8. Scenario / curveball questions
**Q: A user says it missed a phone number. What do you do?**
Reproduce with a fake sample, find why (no pattern? low confidence? format variant?), add a recognizer or rule plus a test, add to the benchmark, log it in CHANGELOG.

**Q: How would you scale this to an enterprise?**
Add a managed policy file (admin-defined levels and rules), audit logs kept locally or exported by the user, and signed enterprise builds. Still no data to a server.

**Q: How would you support other languages?**
Add locale-aware recognizers (national ID formats, phone formats) and a multilingual NER model; keep locale packs optional to control size.

**Q: A competitor does this server-side with better accuracy. Why yours?**
Different trust model. Users who cannot send raw data to any third party have no alternative. I also publish accuracy numbers honestly.

**Q: What if Chrome changes extension rules?**
The engine is independent of Chrome; only the extension package changes. The web app and CLI keep working.

**Q: How would you monetize if you wanted to?**
Keep the core free; offer a paid team policy/management and support tier. (Not planned.)

---

## 9. Quick facts cheat sheet
- Stack: TypeScript, React, Vite, Vitest, Playwright, MV3, pnpm.
- Layers: patterns -> context -> optional NER.
- Levels: Basic, Standard (default), Strict, Custom.
- Mask style: reversible consistent tokens.
- Privacy: no backend, no telemetry, session-only mapping.
- Standards referenced: HIPAA Safe Harbor (18 identifiers), GDPR, PCI-DSS.
- Phases: Setup -> MVP -> Extension -> Files -> NER/OCR/benchmarks.
- Honest limits: not 100% detection, not a compliance certificate.

## 10. Your own notes (fill in as you build)
- Interesting bug I fixed: a URL like `?token=abc123&b=2` was reported as a generic SECRET with the value `abc123&b=2`, hiding the more specific URL_CREDENTIALS finding. The keyword recognizer's value pattern did not stop at `&`, and the resolver's priority put SECRET above URL_CREDENTIALS. I excluded `&` from the value and raised URL_CREDENTIALS priority. Lesson: overlap rules need tests with realistic strings.
- Metric I'm proud of: 51 tests including a 130 KB input in under 2 s and a test that fails if the engine ever calls `fetch`.
- Something I learned: checksums (Luhn, mod-97, ABA) remove most false positives for structured IDs; free-text names are the hard part and need context rules or NER.
- A decision I changed and why: I first planned to store settings in `chrome.storage.sync` for convenience, then realized it uploads custom words to the user's Google account, which contradicts "nothing leaves your device". I switched to `storage.local` and added a test that fails if the synced store ever appears in the source.
- File-masking story: a sentence in a Word file is split across many text runs, so an email can be cut in half. I join each paragraph's runs, scan once, and put the replacement into the run where the match starts. I also found that "masked" files can still leak through tracked deletions, comments, reviewer names and document properties, so those are handled and tested.
- Why PDF output is plain text: drawing black boxes over PDF text leaves the real text underneath. A safe approach is to extract, mask and re-emit text, and be upfront that layout is lost.
- A bug I introduced and caught: while removing the byte order mark from CSV files I briefly ended up with a pattern that stripped the letters "FEFF" from the start of a file. A lint rule flagged the invisible character, my quick fix was wrong, and a test for a CSV that starts with "FEFF" now guards it. Lesson: test the negative case too.
- Extension design points to explain: capture-phase interception, per-site adapters with a visible "not found" badge so failure is never silent, verified writes with a clipboard fallback, one-shot expiring bypass, closed shadow DOM and `textContent` only.
- Honest gap to mention: selectors were tested against mocked pages, not live sites, and the live check list is in MAINTENANCE.md.
