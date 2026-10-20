# Maintenance and Operations Guide

How to set up, run, test, release and keep MaskIT healthy. Every command below exists and was run.

## 1. Prerequisites
- Node.js 20 LTS or newer (developed on 24)
- pnpm 9+
- Git
- Internet access **once**, to download dependencies, the name model (about 66 MB), the OCR language data (about 4 MB) and the test browser (about 120 MB). The product itself never needs the internet.

## 2. Setup
```bash
git clone <repo-url> MaskIT
cd MaskIT
git config core.hooksPath .githooks        # enables the docs-check pre-commit hook
pnpm install
pnpm --filter @maskit/ner fetch-model      # optional: the on-device name model
pnpm --filter @maskit/e2e exec playwright install chromium   # only for browser tests
```
The name model and OCR data are optional at build time: without them everything still builds and works with the pattern rules, and the names/OCR options report that they are not installed. Model files are git-ignored.

### Keeping docs current (enforced)
- `.githooks/pre-commit` blocks a commit that changes code but not `docs/CHANGELOG.md`. Enable it once per clone with the `git config` line above.
- `.github/pull_request_template.md` adds a docs checklist to every pull request.
- CI repeats the changelog check on pull requests, so it also covers clones without the hook.
- `CLAUDE.md` instructs the AI assistant to update the docs on every change and **never to commit or push** (the owner commits).
- `--no-verify` is only for trivial changes (typo, formatting); say so in the commit message.

## 3. Everyday commands
| Task | Command |
|---|---|
| Run all unit tests | `pnpm test` |
| Lint | `pnpm lint` |
| Format code (check only) | `pnpm format` (`pnpm format:check`) |
| Type check | `pnpm typecheck` |
| Build everything | `pnpm build` |
| Start the web app | `pnpm --filter @maskit/web dev` (http://localhost:5173) |
| Build the web app | `pnpm --filter @maskit/web build` (output `packages/web/dist`, any static host) |
| Build the extension | `pnpm --filter @maskit/extension build` (output `packages/extension/dist`) |
| Browser tests (real Chromium) | `pnpm e2e` |
| Refresh `docs/BENCHMARKS.md` | `pnpm bench` (commit the result; a test fails if it is stale) |
| Refresh `docs/BENCHMARKS-NER.md` (needs the model) | `pnpm --filter @maskit/bench bench:ner` |
| Download the name model | `pnpm --filter @maskit/ner fetch-model` |
| Copy model and OCR files into the web app | runs automatically in `dev` and `build`; or `pnpm --filter @maskit/web prepare-model` and `prepare-ocr` |
| Regenerate extension icons | `node packages/extension/scripts/make-icons.mjs` |

Notes:
- `pnpm e2e` builds the web app itself and builds the extension in its own setup. It takes a few minutes; the name-model and OCR tests skip themselves when those files are not installed.
- Tests that need the model (`packages/bench/test/ner.test.ts`, the name-model browser tests) also skip without it.
- Windows: run commands from Git Bash or PowerShell; paths with spaces are not supported by some scripts.

## 4. Loading the extension locally
1. Build: `pnpm --filter @maskit/extension build`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select `packages/extension/dist`.
4. After code changes, rebuild and click the reload icon on the extension card.
5. To try the name option, make sure the model was downloaded **before** building (the build says "Name model included").

## 4a. Live check of the extension on the real sites (do this before publishing)
Already done once, logged out: Gemini and ChatGPT matched the selectors and masked a test email; Claude sits behind a Cloudflare challenge in automated browsers and could not be checked; logged-in layouts were not checked. For each of ChatGPT, Claude and Gemini, signed in:
1. Load the unpacked extension and open the site.
2. Confirm the badge says "MaskIT on" (if it says "prompt box not found", fix the adapter, section 6).
3. Type `Email me at test@example.com` and press Enter: the review dialog must appear and the message must not be sent.
4. Click **Mask selected**: the box must show `[EMAIL_1]`. Press Enter: it sends.
5. Repeat using the Send button, and with a multi-line prompt.
6. Click **Send without masking**, then Send: it sends once; the next send is checked again.
7. Paste an AI reply containing `[EMAIL_1]` into the popup's restore box: it shows the email.
8. Turn on "Also find names, organizations and places", type `Yesterday Priya Nair met Tom Becker`, wait a second, press Enter: both names are listed.
Record results and any selector fixes in CHANGELOG.

## 5. Adding a new recognizer
1. Add the recognizer to the matching file in `packages/core/src/recognizers/` (or a new file) implementing the `Recognizer` interface. If it needs a new entity type, add it to `types.ts`.
2. Add validation (checksum/structure) in `validators.ts` if the format allows it.
3. Register it in `recognizers/index.ts`, add its type to the right levels in `levels.ts`, and give it a slot in `ENTITY_PRIORITY` in `resolver.ts` (stronger validation means higher priority).
4. Write tests: valid samples, invalid samples, near-misses, text with the value embedded.
5. Add a generator for it in `packages/bench/src/generators.ts` and, if useful, a realistic document in `packages/bench/src/realistic.ts`; run `pnpm bench` and commit the refreshed `docs/BENCHMARKS.md`.
6. Update CHANGELOG, ARCHITECTURE (if behavior changed) and USER_GUIDE (coverage table).

## 5a. Adding a new file format
1. Add a handler in `packages/files/src/` that takes bytes, masks text through `maskString` / `maskRuns` / `replacementFor` (never its own detection) and returns bytes. Office formats should reuse `ooxml.ts`.
2. Register the extension in `maskFile()` in `packages/files/src/index.ts` and in `SUPPORTED_EXTENSIONS` (the web file panel's `accept` list is built from it).
3. Test with a small hand-built fixture and, if possible, a real file from the producing application.
4. Add the format to USER_GUIDE and CHANGELOG, and list what is *not* carried over (images, metadata, numeric cells) as a warning in the result.

## 5b. Live check of file masking (do before relying on it)
Automated tests cover hand-built files only. By hand, in `pnpm --filter @maskit/web dev`:
1. Drop a `.txt`, a `.csv` with Name/Email columns, a `.docx` from Word, one from Google Docs, one from LibreOffice, a `.xlsx` from Excel, a text PDF, a scanned PDF (with OCR on), and a phone photo of a document.
2. For each: the counts look right, the download opens in the original app without a repair prompt, and no original value remains (search the output for a known email and name).
3. DOCX: tracked changes, comments, headers/footers, a table; File > Info shows blank author and title.
4. XLSX: formulas still work; a phone number typed as a number is *not* masked (known limit).
Record results in CHANGELOG.

## 5c. Reading and acting on benchmark results
- Open `docs/BENCHMARKS.md`. Look first at the false-positive table, then the hand-written realistic set (the more honest number), then any type below 100%.
- To see failing examples, write a throwaway script in `packages/bench/src/` that prints mismatches (the first run did exactly that), fix the recognizer, add a regression test in core, regenerate, delete the script.
- If you tune a recognizer against a set, its score looks perfect. Add new, different cases so the benchmark keeps finding problems.
- Real-document accuracy is still unmeasured. A good next step is to hand-label 50 to 100 real, non-sensitive or consented documents as a third dataset.

## 6. Fixing a broken AI-site adapter
1. Open the site, inspect the input box and send button. The page badge reading "MaskIT: prompt box not found" confirms the input selector is stale.
2. Update the selectors for that site in `packages/extension/src/adapters.ts` (an exploratory script like the one used for the first live check is in the CHANGELOG entry for the browser tests).
3. Run `pnpm --filter @maskit/extension test` and `pnpm e2e`, then test manually on the real site (4a).
4. Record the fix in CHANGELOG.

## 7. Release process
1. Make sure `main` is green in CI (both the `check` and `e2e` jobs).
2. Update the version in `packages/extension/manifest.json` (semantic versioning).
3. Move CHANGELOG items under the new version heading.
4. Run the live checks (4a, 5b) and record them.
5. Tag: `git tag vX.Y.Z && git push --tags`.
6. Build with the model: `pnpm --filter @maskit/ner fetch-model && pnpm build`.
7. Zip the **contents** of `packages/extension/dist` (files at the top level of the zip) and upload it with the listing in `docs/STORE_LISTING.md`; deploy `packages/web/dist` to static hosting.
8. Publish release notes from the CHANGELOG.

## 8. Branching and commits
- `main` is always releasable. Work on short-lived branches, merge via pull request.
- Commit messages: imperative, short subject, body explains why.
- Each PR: tests included, CHANGELOG updated, docs updated if behavior changed.

## 9. Routine upkeep
| Frequency | Task |
|---|---|
| Weekly | Smoke-test the extension on each supported AI site while signed in |
| Monthly | `pnpm outdated`, update dependencies, re-run tests, benchmarks and `pnpm e2e` |
| On each dependency update | Check for new permissions or network usage; the privacy tests and browser request checks must stay green |
| When changing the model | Re-run `pnpm --filter @maskit/bench bench:ner`, check the licence of the new model, update `docs/PRIVACY_POLICY.md` and `docs/STORE_LISTING.md` if the size changes |
| On format changes (new ID formats, new card ranges) | Update recognizers and tests |
| Quarterly | Review THREAT_MODEL; refresh benchmark numbers in docs |

## 10. Troubleshooting
| Symptom | Likely cause | Fix |
|---|---|---|
| Extension does nothing on a site | Site DOM changed | Fix the adapter (section 6) |
| Many false positives | Pattern too loose or missing validation | Add checksum/context rules and a negative test |
| Missed items | No recognizer or confidence too low | Add recognizer or tune threshold; add to benchmark |
| "Name detection is not available" | Model files were not present at build time, or the offscreen page failed to start | Run `fetch-model`, rebuild; check the extension's service worker console in `chrome://extensions` |
| Names option stuck on "Loading" | First load needs a few seconds; or the model is missing | Wait, then see above |
| OCR says it is not installed | `public/ocr` missing (language data download failed) | Run `pnpm --filter @maskit/web prepare-ocr` with internet access |
| Web build fails at `prepare-ocr` | No internet and no cached language data | The script prints a note and continues; OCR is then unavailable |
| UI freezes on a very large file | Masking runs on the main thread | Split the file; moving it to a worker is planned |
| Browser tests fail to start | Browser not installed | `pnpm --filter @maskit/e2e exec playwright install chromium` |
| Extension browser tests: "ready" never reached | Model not built into the extension | Fetch the model and rebuild |

## 11. Handling a security report
1. Acknowledge within 72 hours.
2. Reproduce and assess severity.
3. Fix on a private branch, add a regression test.
4. Release a patch, credit the reporter (if they agree), add a CHANGELOG note.
