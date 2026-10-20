# Chrome Web Store Listing (draft)

Everything needed to fill in the Chrome Web Store developer dashboard. Nothing here has been submitted. Replace the placeholders before publishing.

## Before you submit: checklist
- [ ] Register a Chrome Web Store developer account (one-time fee, paid by the owner).
- [ ] Test the extension on the real ChatGPT, Claude and Gemini while **signed in** (see MAINTENANCE.md section 4a). Logged-out checks were done for Gemini and ChatGPT; Claude could not be checked.
- [ ] Decide whether to ship the name model: with it the package is about 87 MB; without it about 3 MB (`pnpm --filter @maskit/extension build` includes it only if `pnpm --filter @maskit/ner fetch-model` was run).
- [ ] Take 1-5 screenshots (1280x800) and, optionally, a 440x280 promo tile.
- [ ] Host `PRIVACY_POLICY.md` at a public URL and put the link in the dashboard.
- [ ] Replace the repository link in the policy and below.
- [ ] Bump `version` in `packages/extension/manifest.json`, update CHANGELOG, tag the release.
- [ ] Zip the contents of `packages/extension/dist` (the files at the top level of the zip, not the folder).

## Name (max 75 characters)
MaskIT: Hide personal data before you use AI

## Summary (max 132 characters)
Finds and masks personal, health and financial data in your prompts before they reach an AI chatbot. Runs fully on your device.

## Category
Productivity (or Privacy & Security if offered)

## Description
MaskIT checks what you are about to send to an AI chatbot and masks sensitive information first, so you can use AI without handing over personal data.

How it works
- Type your prompt as usual and press Enter.
- If MaskIT finds something sensitive, it pauses the send and shows what it found.
- Untick anything that is fine to send, then choose "Mask selected". Your text now shows placeholders such as [EMAIL_1] or [PERSON_1].
- Read it, then send. The AI only sees placeholders.
- Open the MaskIT popup, paste the AI's reply, and click Restore to put the real values back (done locally, in your tab).

What it finds
- Emails, phone numbers, addresses, dates of birth
- ID numbers (US SSN, passport), medical record and insurance numbers
- Credit card, bank account and IBAN numbers
- Passwords, API keys, tokens and private keys
- IP addresses, device addresses, GPS coordinates
- Optionally, names, organizations and places in ordinary text, using a small model that runs on your device
- Your own list of words to always mask

Three levels: Basic, Standard and Strict (approaches HIPAA Safe Harbor-style de-identification).

Privacy first
- Everything runs on your device. Your text is never uploaded, logged or sent to the developer.
- No account, no tracking, no ads.
- Open source, so you can check these claims.

Supported sites: ChatGPT, Claude, Gemini.

Important: no tool catches everything. Review the text before you send it. MaskIT is a safety aid, not a compliance certification.

## Single purpose statement (required)
MaskIT's single purpose is to detect and mask sensitive personal information in the prompts a user is about to send to supported AI chat websites.

## Permission justifications (required)
- **Host access (chatgpt.com, chat.openai.com, claude.ai, gemini.google.com):** the extension reads the user's prompt in the page's input box and, only after the user approves, replaces sensitive values with placeholders. It is limited to these four sites.
- **storage:** saves the user's settings (on/off, level, optional words) on the device.
- **offscreen:** hosts the optional on-device name-detection model in a hidden extension page, because extension service workers cannot hold a large model in memory.
- **Remote code:** none. All code, including the model, is packaged in the extension. No requests are made to any server.

## Data usage disclosures (dashboard form)
- Does the extension collect or use user data? It handles the text the user types in the prompt box locally to find sensitive data; it does not collect, store or transmit it.
- Certify that data is not sold, not used for unrelated purposes, and not used for creditworthiness or lending: yes.
- Collected data types to tick: none (processing happens on the device; nothing leaves it).

## Support and links
- Homepage / repository: (add link)
- Privacy policy: (add public URL of PRIVACY_POLICY.md)
- Support: issues page of the repository

## Release notes (first version)
First release: masking for ChatGPT, Claude and Gemini with three levels, review before sending, reversible placeholders, custom words and an optional on-device name model.
