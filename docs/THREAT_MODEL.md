# Threat Model

> Status: reviewed against the implemented system on 2026-10-20 (rows T1 to T26 describe real mitigations unless marked planned). Review each quarter and after any architectural change.

## Assets
1. The user's original sensitive text and files.
2. The mapping (placeholder to real value).
3. User settings and custom rules (may contain sensitive terms).
4. The integrity of the extension itself.

## Trust boundaries
- **Trusted:** MaskIT code running locally.
- **Partially trusted:** the AI website page (we must read its input box but not trust it).
- **Untrusted:** the network, other extensions, third-party dependencies.

## Threats and mitigations

| # | Threat | Mitigation |
|---|---|---|
| T1 | MaskIT leaks data to a server | No backend; no network permissions; automated no-network test; open source |
| T2 | AI page script reads the original text before masking | Mask before the text reaches the page's send handler; isolate content script; keep mapping outside the page context |
| T3 | AI page reads the mapping | Mapping stored only in the extension context (service worker / extension storage), never injected into the page DOM |
| T4 | Mapping persists and is stolen from disk | Session-only by default; opt-in persistence is WebCrypto-encrypted |
| T5 | Malicious or compromised dependency (supply chain) | Minimal deps, lockfile, pinned versions, audit in CI, review updates |
| T6 | Overbroad extension permissions abused | Host permissions only for supported sites; no `<all_urls>` |
| T7 | Remote code or `eval` injection | Strict CSP, no remote scripts, no `eval` |
| T8 | Malicious file crafted to exploit parser | Use maintained parsers, run in workers, size limits, fuzz tests |
| T9 | False negatives give false confidence | Mandatory review UI, published results with a known-gaps table and an explicit warning that the data is synthetic, clear limitations. A CI benchmark guard stops accuracy from silently dropping |
| T10 | Tampered release build | Reproducible builds, signed tags, official store distribution |
| T11 | Other extensions reading page content | Out of our control; documented in limitations |
| T12 | Logs or error messages contain user data | Never log input text; sanitize errors |
| T13 | Settings (custom words) uploaded by browser sync | Settings use `chrome.storage.local`, never the synced store; a test fails if the synced store is used |
| T14 | Extension silently stops protecting after a site redesign | Visible badge ("prompt box not found"); adapter tests; manual live check before each release |
| T15 | Rich editor rejects the masked text, leaving the original in the box | Result is verified; on mismatch the masked text goes to the clipboard and the user is warned |
| T16 | "Send without masking" left active and a later prompt slips through | The permission is one-shot and expires after 10 seconds |
| T18 | Original text survives inside a masked Word file (tracked deletions, comments, headers, document properties, reviewer names) | The DOCX handler masks all text parts including deleted text, anonymizes comment authors and blanks document properties; images are called out as not scanned |
| T19 | Malformed or oversized file freezes or exhausts the tab | 25 MB input limit, 100 MB limit on unzipped DOCX contents, invalid files rejected with a message. Processing still runs on the main thread (moving it to a worker is **(planned)**) |
| T20 | The model or its runtime is swapped for a malicious or leaking one (supply chain) | Pinned dependency versions and lockfile; the model is downloaded once by a script from a named repository, licence checked, then packaged; extension pages and the web app may read only their own files, so even a tampered model has no route to send data out; privacy tests and browser request recording would show any attempt |
| T21 | Another extension or page message reaches the name model or the service worker | Handlers accept only messages whose sender is this extension; the worker answers only the two model message types |
| T22 | The model and OCR engine use WebAssembly, which needs a relaxed policy | Only `wasm-unsafe-eval` is added; plain `unsafe-eval`, remote scripts and wildcards are forbidden and asserted by tests |
| T23 | Many tabs race to start the offscreen page and the option silently turns off | Creation is shared across tabs and failures are retried; covered by a browser test |
| T24 | Held sends are repeated incorrectly or sent twice | The repeat uses a one-shot bypass that expires after 10 seconds and consumes itself on first use |
| T25 | Hidden text survives in a masked Excel file (comments, authors, properties) | Same handling as Word; numeric cells, sheet names and formulas are stated as not scanned |
| T26 | OCR output is wrong, so a value is not recognized | Warning on every OCR result; review is always required; accuracy on messy scans is unmeasured |
| T17 | Look-alike domain activates the extension | Hosts are matched exactly (or as real subdomains); manifest lists only four hosts |

## Out of scope
- A compromised operating system or browser.
- Malware with access to the user's machine.
- The AI provider's handling of already-masked text.

## Security testing
- No-network assertion test in CI.
- Dependency audit in CI.
- Fuzz tests on parsers.
- Manual review of manifest permissions on each release.
