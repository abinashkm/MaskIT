# Threat Model

> Status: initial design-time model. Review each quarter and after any architectural change.

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
| T9 | False negatives give false confidence | Mandatory review UI, published recall, clear limitations |
| T10 | Tampered release build | Reproducible builds, signed tags, official store distribution |
| T11 | Other extensions reading page content | Out of our control; documented in limitations |
| T12 | Logs or error messages contain user data | Never log input text; sanitize errors |

## Out of scope
- A compromised operating system or browser.
- Malware with access to the user's machine.
- The AI provider's handling of already-masked text.

## Security testing
- No-network assertion test in CI.
- Dependency audit in CI.
- Fuzz tests on parsers.
- Manual review of manifest permissions on each release.
