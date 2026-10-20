# MaskIT: instructions for Claude

MaskIT is a free, local-first PII/PHI/secrets masking tool (Chrome extension, web app, shared core engine). Read `docs/PLAN.md` and `docs/ARCHITECTURE.md` before making changes.

## Documentation rules (always)

- Every code change must add an entry to `docs/CHANGELOG.md` in the same commit: what changed, where, how it works, why, tests.
- Record non-obvious technical choices in `docs/DECISIONS.md` (next D-number).
- Update `docs/ARCHITECTURE.md`, `docs/USER_GUIDE.md`, `docs/MAINTENANCE.md` when behavior, usage or commands change.
- Add new interview-relevant learnings (bugs, trade-offs) to `docs/INTERVIEW_GUIDE.md` section 10.
- Mark unbuilt items **(planned)**; docs must describe what actually exists.

## Project rules

- All processing is client-side. Never add network calls, telemetry or logging of user text.
- Detection logic lives only in `packages/core`; front-ends do UI and I/O only.
- Every recognizer needs tests (valid, invalid, near-miss, embedded).
- Make no compliance claims such as "HIPAA compliant".
- Never commit or push. The owner makes all commits themselves (explicit instruction, 2026-10-20). Leave changes in the working tree and say what changed.
