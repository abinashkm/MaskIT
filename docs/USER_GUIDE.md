# User Guide

> Status: the **web app** (including file masking) and the **Chrome extension** are built and can be run locally (see MAINTENANCE.md). Neither has been checked by hand in a browser against real-world files or the live AI sites yet, and the extension is not on the Chrome Web Store.

## What MaskIT does
MaskIT finds sensitive information in your text or files and replaces it with safe placeholders **before** you paste it into an AI tool. Everything happens on your device. Nothing is uploaded.

## Install (planned)
- **Chrome extension:** install from the Chrome Web Store, then pin it to your toolbar.
- **Web app:** open the MaskIT page; no install needed.

## Using the web app (available now)
1. Paste your text into box 1 and choose a level and style.
2. Box 2 lists everything found. Untick any item that should stay.
3. Copy the masked text from box 3 and paste it into your AI tool.
4. Paste the AI reply into box 4 and click **Restore** to put the real values back. The mapping exists only while the page is open.

## Using the extension
Supported sites: ChatGPT (chatgpt.com), Claude (claude.ai), Gemini (gemini.google.com).
1. Open a supported AI site. A small badge in the corner says "MaskIT on".
2. Type or paste your prompt as usual and press Enter (or click Send).
3. If sensitive items are found, the send is paused and a window lists them.
4. Untick anything that is fine to send, then click **Mask selected**. The box now shows placeholders like `[PERSON_1]`.
5. Read the text, then press Enter or Send yourself. The AI only sees placeholders.
6. To get real values back, open the MaskIT toolbar popup, paste the AI's reply and click **Restore**.
- **Send without masking** lets exactly one send through (for 10 seconds); the next prompt is checked again.
- If the badge says "prompt box not found", the site changed and MaskIT is **not** protecting that page. Update the extension or use the web app.
- The toolbar popup has the on/off switch, level, and your own always-mask words.

## Using files (web app)
Use the **Mask a file** box: choose a file or drop it there. The level, style and always-mask words you set above apply. You get a count of what was masked, any warnings, and a download.

| Format | What you get | Good to know |
|---|---|---|
| TXT, MD, LOG, JSON | Masked file of the same type | Treated as plain text |
| CSV, TSV | Masked file, same delimiter | Each cell is checked; columns named like Name, Email, DOB, SSN are masked entirely. The header row is kept |
| DOCX | Masked Word file | Keeps formatting. Also masks headers, footers, footnotes, comments and tracked-deletion text, replaces reviewer names with "Author" and clears the author, title and company in the file properties. **Images are not scanned** |
| PDF | Masked **plain text** (`.masked.txt`) | Layout and images are dropped. Scanned PDFs (no selectable text) are refused because OCR is not available yet |
| XLSX | Not supported yet **(planned)** | Export as CSV for now |

Files up to 25 MB. Open the masked file and read it before sharing: no tool catches everything.

## Choosing a masking level
| Level | Masks | Use when |
|---|---|---|
| Basic | Emails, phones, IDs, cards, keys and secrets | Quick everyday use |
| Standard (default) | Basic plus names, addresses, dates of birth | Most work documents |
| Strict | Standard plus all dates, small locations, organizations, ages over 89 | Health or highly sensitive data |
| Custom | You choose categories and add your own terms/patterns | Special needs |

## What gets detected
Names, emails, phone numbers, addresses, national IDs (SSN etc.), passport and licence numbers, dates of birth, medical record and insurance IDs, credit cards, bank accounts and IBANs, API keys and passwords, IP/MAC addresses, tokens in URLs, GPS coordinates, and organization/location names (with the optional name-detection model).

## Privacy
- No account, no server, no tracking.
- The placeholder-to-real-value table stays in your browser's memory for the session and is cleared when you close the browser.
- The code is open source so you can check these claims.

## How accurate is it?
On the project's own synthetic test set (see [BENCHMARKS.md](BENCHMARKS.md)) the rules find every labeled item and flag almost no ordinary text. That set is written by the author and is easier than real documents, so **real-world accuracy is unknown**. Known misses: names with no label such as "Name:" or "Dr.", bare 9-digit SSNs and 10-digit phone numbers with no hint word, dates of birth with no label (only caught as a plain date at the strict level), and non-US addresses.

## Limits (please read)
- **No tool catches everything.** Always review before sending.
- Name and organization detection is less accurate than pattern-based detection.
- Scanned documents need the optional OCR feature and may have errors.
- Unusual formats, other languages and misspellings can be missed.
- MaskIT supports HIPAA Safe Harbor-style de-identification but is **not** a certification of compliance.
- If an AI site changes its layout, the extension may stop working until updated; use the paste-in box as a fallback.

## Troubleshooting
| Problem | Try |
|---|---|
| Nothing highlighted | Check the extension is enabled for that site and the level is not too low |
| Too many false highlights | Untick them in the review step, or lower the level |
| Restore does not work | The session may have ended (browser closed); the table is cleared by design |
| Extension stopped working on a site | Update the extension, or use the paste-in box |

## Reporting problems
Open an issue on the project repository. **Never include real sensitive data** in a report; use fake examples.
