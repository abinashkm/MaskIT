# MaskIT Documentation

MaskIT is a free, local-first tool that masks PII, PHI, financial data and secrets before you send text or documents to AI tools. Nothing leaves your browser.

**Project status:** core engine (`packages/core`), web demo (`packages/web`) and Chrome extension (`packages/extension`, not yet checked on live sites) are implemented; file parsing and NER are next (see [PLAN](PLAN.md) section 11a and [CHANGELOG](CHANGELOG.md)).

## Index

| Doc | Audience | What it answers |
|---|---|---|
| [PLAN.md](PLAN.md) | Owner, contributors | What are we building, in what order, and why? |
| [CHANGELOG.md](CHANGELOG.md) | Owner, contributors | What changed, where is it in the code, how does it work? Updated with every change. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Owner, contributors | How is the system structured and how does data flow? |
| [DECISIONS.md](DECISIONS.md) | Owner, interviewers | Why did we choose X over Y? (decision records) |
| [MAINTENANCE.md](MAINTENANCE.md) | Owner, maintainers | How do I set up, run, test, release and keep this project healthy? |
| [USER_GUIDE.md](USER_GUIDE.md) | End users | How do I install and use MaskIT? What are its limits? |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Security reviewers | What are we protecting, from whom, and how? |
| [GLOSSARY.md](GLOSSARY.md) | Everyone | What do PII, PHI, NER, Safe Harbor, etc. mean? |
| [INTERVIEW_GUIDE.md](INTERVIEW_GUIDE.md) | Owner | What might an interviewer ask about this project, and how do I answer? |

## Documentation rules
1. Every code change updates [CHANGELOG.md](CHANGELOG.md) in the same commit.
2. Every non-obvious technical choice gets an entry in [DECISIONS.md](DECISIONS.md).
3. Behavior changes also update [ARCHITECTURE.md](ARCHITECTURE.md) and [USER_GUIDE.md](USER_GUIDE.md) as needed.
4. Docs describe what exists. Planned items are marked **(planned)**.
