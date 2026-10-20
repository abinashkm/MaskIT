# User Guide

> Status: the **web app** (text, files, PDF, OCR, optional name model) and the **Chrome extension** are built and tested in a real browser. They have not been checked by hand with real-world Office files, and the extension has been checked only against test pages and the logged-out Gemini and ChatGPT pages, not signed in and not on Claude (see MAINTENANCE.md, 4a and 5b). The extension is not on the Chrome Web Store yet.

## What MaskIT does
MaskIT finds sensitive information in your text or files and replaces it with safe placeholders **before** you paste it into an AI tool. Everything happens on your device. Nothing is uploaded.

## Install
- **Web app:** build it (`pnpm --filter @maskit/web build`) and host the `dist` folder anywhere static, or run `pnpm --filter @maskit/web dev`. No account needed.
- **Chrome extension:** until it is in the Chrome Web Store, build it and load it unpacked (MAINTENANCE.md, section 4). Pin it to your toolbar.

## Using the web app
1. Paste your text into box 1 and choose a level and style.
2. Box 2 lists everything found. Untick any item that should stay.
3. Click **Copy masked text** (or select and copy it) and paste it into your AI tool. Copying saves the placeholders so replies can be restored.
4. Paste the AI reply into the restore box and click **Restore** to put the real values back. The mapping exists only while the page is open.
5. Optional: tick **Find names, organizations and places** to also catch names that have no label such as "Patient:". This loads a 66 MB model from the same site the first time.

## Using the extension
Supported sites: ChatGPT (chatgpt.com), Claude (claude.ai), Gemini (gemini.google.com).
1. Open a supported AI site. A small badge in the corner says "MaskIT on".
2. Type or paste your prompt as usual and press Enter (or click Send).
3. If sensitive items are found, the send is paused and a window lists them.
4. Untick anything that is fine to send, then click **Mask selected**. The box now shows placeholders like `[PERSON_1]`.
5. Read the text, then press Enter or Send yourself. The AI only sees placeholders.
6. To get real values back, open the MaskIT toolbar popup, paste the AI's reply and click **Restore**.

- **Send without masking** lets exactly one send through (for 10 seconds); the next prompt is checked again.
- **Find names, organizations and places** (popup checkbox): uses a model bundled with the extension, on your device. MaskIT checks your text in the background while you pause; if you send right after typing, it holds the send for a moment, and sends it for you if nothing is found. If this build was made without the model, the popup says so.
- If the badge says "prompt box not found", the site changed and MaskIT is **not** protecting that page. Update the extension or use the web app.
- The popup has the on/off switch, level, the names option, and your own always-mask words.

## Using files (web app)
Use the **Mask a file** box: choose a file or drop it there. The level, style, names option and always-mask words you set above apply. You get a count of what was masked, any warnings, and a download.

| Format | What you get | Good to know |
|---|---|---|
| TXT, MD, LOG, JSON | Masked file of the same type | Treated as plain text |
| CSV, TSV | Masked file, same delimiter | Each cell is checked; columns named like Name, Email, DOB, SSN are masked entirely. The header row is kept |
| DOCX | Masked Word file | Keeps formatting. Also masks headers, footers, footnotes, comments and tracked-deletion text, replaces reviewer names with "Author" and clears the author, title and company in the file properties. **Images are not scanned** |
| XLSX | Masked Excel file | Keeps formatting and formulas. Masks text cells and comments, replaces comment authors, clears document properties. **Numbers stored as numeric cells, sheet names, formulas and charts are not scanned** |
| PDF | Masked **plain text** (`.masked.txt`) | Layout, images and metadata are dropped |
| PDF without text (scans), images (PNG, JPG, WebP, BMP, GIF) | Masked **plain text** | Tick **Read scanned pages and images (OCR, English)** first. OCR runs on your device, takes a few seconds per page, and can misread characters, so check the result |

Files up to 25 MB. Open the masked file and read it before sharing: no tool catches everything.

## Choosing a masking level
| Level | Masks | Use when |
|---|---|---|
| Basic | Emails, phones, IDs, cards, keys and secrets | Quick everyday use |
| Standard (default) | Basic plus names, addresses, dates of birth, health and network IDs | Most work documents |
| Strict | Standard plus all dates, ages over 89, organizations and places (organizations and places need the names option) | Health or highly sensitive data |

(A fourth, custom level exists in the engine, where the caller picks exact categories; the apps expose your own always-mask words instead.)

## What gets detected
Names, emails, phone numbers, addresses, national IDs (SSN etc.), passport numbers, dates of birth, medical record and insurance IDs, credit cards, bank accounts and IBANs, API keys, tokens and passwords, IP and MAC addresses, tokens in URLs, GPS coordinates, and, with the names option, organizations and places.

## Privacy
- No account, no server, no tracking, no analytics. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).
- The placeholder-to-real-value table stays in memory (the tab or the page) and is cleared when you reload or close it. It is never saved to disk.
- The name model, the OCR engine and its language data are files that ship with the app; nothing is downloaded when you use it.
- The code is open source so you can check these claims.

## How accurate is it?
Two tests, both written by the project author, both in [BENCHMARKS.md](BENCHMARKS.md):
- A generated set of formats the rules were built for: every labeled item is found and ordinary text is not flagged. This mainly guards against regressions.
- A small hand-written set of messier documents (notes, emails, logs, chats, JSON): the rules alone found about 81% of the values at the default level with no false alarms; adding the names option raised that to about 97% ([BENCHMARKS-NER.md](BENCHMARKS-NER.md)).

**Real-world accuracy is unknown** and is probably lower than these numbers. Known misses: names with no label unless the names option is on, bare 9-digit SSNs and 10-digit phone numbers with no hint word, dates of birth with no label (only caught as a plain date at the strict level), non-US addresses and dates written in other languages.

## Limits (please read)
- **No tool catches everything.** Always review before sending.
- The names option is English only, trained on news-style text, so unusual names, lowercase text and short chat messages are weaker. It can also flag ordinary capitalized words.
- OCR can misread characters; check scanned results.
- Numbers typed as numeric cells in Excel are not scanned.
- Unusual formats, other languages and misspellings can be missed.
- MaskIT supports HIPAA Safe Harbor-style de-identification but is **not** a certification of compliance.
- If an AI site changes its layout, the extension may stop working until updated; the badge tells you, and the web app is the fallback.

## Troubleshooting
| Problem | Try |
|---|---|
| Nothing highlighted | Check the extension is enabled for that site and the level is not too low |
| Too many false highlights | Untick them in the review step, or lower the level |
| Restore does not work | In the web app, use the Copy button first. In both, the mapping is cleared when you reload or close the tab, by design |
| Extension stopped working on a site | Update the extension, or use the web app |
| "Not available" next to the names option | The model files were left out of this build |
| A scanned PDF or image is refused | Tick the OCR option first. If it says OCR is not installed, the OCR files were left out of this build |

## Reporting problems
Open an issue on the project repository. **Never include real sensitive data** in a report; use fake examples.
