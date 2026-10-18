# User Guide

> Status: describes the **intended** product. Not available yet; this guide will be updated as features ship.

## What MaskIT does
MaskIT finds sensitive information in your text or files and replaces it with safe placeholders **before** you paste it into an AI tool. Everything happens on your device. Nothing is uploaded.

## Install (planned)
- **Chrome extension:** install from the Chrome Web Store, then pin it to your toolbar.
- **Web app:** open the MaskIT page; no install needed.

## Using the extension
1. Open a supported AI site.
2. Paste or type your text as usual.
3. MaskIT shows "N sensitive items found" with each item highlighted.
4. Review: untick anything that should stay, then click **Mask**.
5. Send. The AI sees placeholders like `[PERSON_1]`.
6. Click **Restore** on the AI's reply to put the real values back (locally).

## Using files
Drag a TXT, DOCX, PDF or CSV/XLSX file into the web app. Review the findings and download the masked copy.

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
