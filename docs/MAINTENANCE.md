# Maintenance and Operations Guide

How to set up, run, test, release and keep MaskIT healthy.

> Commands marked **(planned)** do not exist yet (they need the extension, web app or benchmark packages). The rest work today.

## 1. Prerequisites
- Node.js 20 LTS or newer
- pnpm 9+
- Git
- Google Chrome (for extension testing)

## 2. Setup
```bash
git clone <repo-url> MaskIT
cd MaskIT
git config core.hooksPath .githooks   # enables the docs-check pre-commit hook
pnpm install
```

### Keeping docs current (enforced)
- `.githooks/pre-commit` blocks a commit that changes code but not `docs/CHANGELOG.md`. It must be enabled once per clone with the `git config` line above.
- `.github/pull_request_template.md` adds a docs checklist to every pull request.
- `CLAUDE.md` instructs the AI assistant to update the docs on every change.
- `--no-verify` is only for trivial changes (typo, formatting); say so in the commit message.
- **(planned)** A CI job repeating the changelog check, so it also covers clones without the hook.

## 3. Everyday commands (planned)
| Task | Command |
|---|---|
| Run all tests | `pnpm test` |
| Format code | `pnpm format` (check only: `pnpm format:check`) |
| Run core tests in watch mode | `pnpm --filter core test --watch` |
| Lint and format check | `pnpm lint` |
| Type check | `pnpm typecheck` |
| Start web app locally | `pnpm --filter @maskit/web dev` (opens on http://localhost:5173) |
| Build web app | `pnpm --filter @maskit/web build` (output in `packages/web/dist`, any static host) |
| Build extension **(planned)** | `pnpm --filter extension build` |
| Build everything | `pnpm build` |
| Run E2E tests **(planned)** | `pnpm e2e` |
| Run benchmarks **(planned)** | `pnpm bench` |

## 4. Loading the extension locally
1. Build: `pnpm --filter extension build`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select `packages/extension/dist`.
4. After code changes, rebuild and click the reload icon on the extension card.

## 5. Adding a new recognizer
1. Add the recognizer to the matching file in `packages/core/src/recognizers/` (or a new file) implementing the `Recognizer` interface. If it needs a new entity type, add it to `types.ts`.
2. Add validation (checksum/structure) in `validators.ts` if the format allows it.
3. Register it in `recognizers/index.ts`, add its type to the right levels in `levels.ts`, and give it a slot in `ENTITY_PRIORITY` in `resolver.ts`.
4. Write tests: valid samples, invalid samples, near-misses, text with the value embedded.
5. Add it to the benchmark dataset **(planned)**.
6. Update CHANGELOG, ARCHITECTURE (if behavior changed) and USER_GUIDE (coverage table).

## 6. Fixing a broken AI-site adapter
1. Open the site, inspect the input box and send button.
2. Update selectors in `packages/extension/src/adapters/<site>.ts`.
3. Run the adapter E2E test against the mocked page, then test manually on the real site.
4. Record the fix in CHANGELOG.

## 7. Release process
1. Make sure `main` is green in CI.
2. Update the version (semantic versioning: MAJOR.MINOR.PATCH).
3. Move CHANGELOG items under the new version heading.
4. Tag: `git tag vX.Y.Z && git push --tags`.
5. CI builds artifacts: extension zip and static web build.
6. Upload the zip to the Chrome Web Store dashboard; deploy the web build to static hosting.
7. Publish release notes from the CHANGELOG.

## 8. Branching and commits
- `main` is always releasable. Work on short-lived branches, merge via pull request.
- Commit messages: imperative, short subject (for example `Add IBAN recognizer`), body explains why.
- Each PR: tests included, CHANGELOG updated, docs updated if behavior changed.

## 9. Routine upkeep
| Frequency | Task |
|---|---|
| Weekly | Smoke-test the extension on each supported AI site |
| Monthly | `pnpm outdated`, update dependencies, re-run full tests and benchmarks |
| On each dependency update | Check for new permissions or network usage; re-run the no-network test |
| On format changes (new ID formats, new card ranges) | Update recognizers and tests |
| Quarterly | Review THREAT_MODEL and LIMITATIONS; refresh benchmark numbers in docs |

## 10. Troubleshooting
| Symptom | Likely cause | Fix |
|---|---|---|
| Extension does nothing on a site | Site DOM changed | Fix the adapter (section 6) |
| Many false positives | Pattern too loose or missing validation | Add checksum/context rules and a negative test |
| Missed items | No recognizer or confidence too low | Add recognizer or tune threshold; add to benchmark |
| NER fails to load | Model file missing or blocked by CSP | Check packaged model path and CSP `wasm-unsafe-eval` setting |
| UI freezes on large text | Analysis on main thread | Move to Web Worker, chunk the input |

## 11. Handling a security report
1. Acknowledge within 72 hours.
2. Reproduce and assess severity.
3. Fix on a private branch, add a regression test.
4. Release a patch, credit the reporter (if they agree), add a CHANGELOG note.
