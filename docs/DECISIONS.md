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
