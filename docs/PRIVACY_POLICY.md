# MaskIT Privacy Policy

_Last updated: 2026-10-20. Draft for the project owner to review, and to have checked by a lawyer if MaskIT is published under a company or for commercial use. This is not legal advice._

## The short version
MaskIT works entirely on your device. It does not send your text, files, settings or any usage information to the developer or to anyone else. There are no accounts, no analytics and no advertising.

## What MaskIT processes
- **Text you type in the prompt box** of a supported AI website (ChatGPT, Claude, Gemini), so it can look for personal data before you send it.
- **Files you choose** in the MaskIT web page, so it can mask them.
- **Settings you choose**: on/off, masking level, optional "always mask" words, and whether to look for names.

## Where it is processed and stored
- All detection and masking run **in your browser**, on your device. The optional name-detection model is a file bundled with MaskIT and runs locally.
- **Settings** (including your always-mask words) are saved in your browser's local extension storage on this device. They are **not** synced to your Google account.
- The **mapping** between placeholders such as `[EMAIL_1]` and the real values is kept in memory in the open tab only. It disappears when you reload or close the tab. It is never written to disk and never sent anywhere.
- The web page keeps its mapping in memory only, until you clear it or close the page.

## What MaskIT does not do
- It does not transmit your prompts, files, mappings or settings to any server.
- It does not collect analytics, crash reports or identifiers.
- It does not read pages other than the supported AI websites listed below.
- It does not sell or share data, because it does not collect any.

## Permissions the extension asks for, and why
| Permission | Why |
|---|---|
| Access to `chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com` | To read your prompt before you send it and, if you approve, replace sensitive values with placeholders |
| `storage` | To remember your settings on this device |
| `offscreen` | To run the optional name-detection model in a hidden page of the extension |

## What the AI website sees
MaskIT changes what you send only when you approve. After masking, the AI website receives placeholders instead of the original values. If you choose "Send without masking", the original text is sent to that website under that website's own privacy policy. MaskIT cannot control what an AI provider does with text it receives.

## Limits
MaskIT cannot guarantee that it finds every piece of personal data. Always review the text before sending. MaskIT is a safety aid and is not a compliance certification.

## Children
MaskIT is not directed at children and collects no data from anyone.

## Changes
If this policy changes, the new version will be published with the extension and the date above will be updated.

## Contact
Open an issue on the project repository: <https://github.com/> (replace with the real repository link before publishing). Do not include real personal data in an issue.
