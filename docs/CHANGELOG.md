# Change Log

Every change is recorded here: **what** changed, **where** it lives, and **how it works**. Newest first. Update this in the same commit as the change.

## Entry template
```
### YYYY-MM-DD: short title
- **What:** one-line summary of the change.
- **Where:** files / packages touched.
- **How it works:** plain-language explanation, including any non-obvious logic.
- **Why:** reason (link to DECISIONS.md entry if one exists).
- **Tests:** what covers it.
- **Docs updated:** which docs changed.
```

---

### 2026-10-18: Core masking engine (Phase 0 scaffold + Phase 1 engine)
- **What:** Monorepo scaffold and the first working `@maskit/core` engine: 19 recognizers, four masking levels, overlap resolution, reversible token masking with restore, and custom deny-list terms.
- **Where:**
  - Tooling: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.gitattributes`, `LICENSE`, `.github/workflows/ci.yml`.
  - Engine: `packages/core/src/` with `types.ts`, `levels.ts`, `validators.ts`, `resolver.ts`, `analyzer.ts`, `masker.ts`, `index.ts` and `recognizers/` (`contact`, `financial`, `identity`, `secrets`, `network`, `custom`).
  - Tests: `packages/core/test/recognizers.test.ts`, `engine.test.ts` (51 tests).
- **How it works:**
  1. `analyze(text, options)` runs each recognizer whose entity types are enabled by the level, drops findings below the level's minimum confidence, then `resolve()` removes overlaps (entity priority, then confidence, then longer span).
  2. Structured data is validated, not just pattern-matched: Luhn (cards), mod-97 (IBAN), ABA checksum (routing), SSN structure rules, IP octet ranges, real calendar day/month.
  3. Ambiguous data needs context: nine bare digits are an SSN only after "SSN"; a date is a date of birth only after "DOB/born"; bare 10-digit runs are phones only after "phone/tel/mobile".
  4. `maskText()` swaps each finding for a token like `[EMAIL_1]` through a `MaskSession`. The same value (normalized, so `A@X.COM` equals `a@x.com` and phone formats are ignored) always gets the same token. `restoreText()` reverses tokens locally. `style: "redact"` gives irreversible `[REDACTED]`.
  5. Levels: basic (min confidence 0.8: contact, financial, secrets), standard (0.5, adds names, addresses, DOB, health IDs, network IDs), strict (0.3, adds all dates, ages over 89; organization/location wait for NER), custom (caller picks types).
  6. Names are detected only after labels or titles ("Patient:", "Dr.") until the NER layer exists **(planned)**.
- **Why:** Establish the core of the product first; every front-end depends on it (D-002, D-003, D-004, D-011, D-012).
- **Tests:** Per-recognizer positive, negative and near-miss cases; level behavior; token reuse; restore round-trip; resolver priority; 130 KB input under 2 s; a test that fails if `fetch` is called; false-positive checks on code and ordinary prose. Fake secrets in tests are built by string concatenation so secret scanners do not flag the repo.
- **Docs updated:** CHANGELOG, ARCHITECTURE, MAINTENANCE, DECISIONS (D-011, D-012), PLAN (progress), INTERVIEW_GUIDE (section 10), docs/README.

### 2026-10-18: Docs-update enforcement added
- **What:** A pre-commit hook and a PR template that force docs to be updated alongside changes.
- **Where:** `.githooks/pre-commit`, `.github/pull_request_template.md`, `docs/MAINTENANCE.md` (section 2), `CLAUDE.md`.
- **How it works:** The hook lists staged files; if any are not docs or markdown and `docs/CHANGELOG.md` is not staged, the commit fails with instructions. It is activated per clone with `git config core.hooksPath .githooks` (already set in this clone). The PR template adds a docs checklist.
- **Why:** Docs go stale unless something checks them (see D-010).
- **Tests:** Verified manually: a commit with code but no changelog is rejected, and one with both passes.
- **Docs updated:** MAINTENANCE, CHANGELOG, DECISIONS (D-010).

### 2026-10-18: Documentation suite created
- **What:** Added the full docs set: plan, architecture, decisions, maintenance, user guide, threat model, glossary, interview guide, and this change log.
- **Where:** `docs/` (all files), `CLAUDE.md` at repo root.
- **How it works:** `docs/README.md` is the index. `CLAUDE.md` tells the AI assistant to keep the change log and decisions current on every change.
- **Why:** Keep the project understandable for the owner, users and interviewers from day one.
- **Tests:** n/a (documentation).
- **Docs updated:** all of them (initial versions).

### 2026-10-18: Project plan written, old README removed
- **What:** Removed the unrelated placeholder `README.md` (it described a different project). Added the MaskIT plan, then moved it into `docs/`.
- **Where:** `docs/PLAN.md` (originally `PLAN.md` at root).
- **How it works:** The plan defines vision, coverage, detection pipeline, masking levels, architecture, security, testing, roadmap and risks.
- **Why:** Decide the product direction before writing code.
- **Tests:** n/a.
- **Docs updated:** PLAN.md.
