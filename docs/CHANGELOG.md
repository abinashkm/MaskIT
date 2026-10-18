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
