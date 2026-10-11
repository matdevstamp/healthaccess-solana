# Task: Ripwire Architecture Artifacts

## Metadata
- **Priority:** P0 - Foundation
- **Deadline:** 2026-09-07
- **Status:** DONE
- **Assignee:** Team (Gate 1 — Matias coordinates)
- **Tags:** ripwire, architecture, documentation, mermaid, required, gate:1-decisions
- **Dependencies:** 01-project-setup-group-contract.md, 02-database-choice-discussion.md
- **Related:** 20-documentation.md
- **GitHub Issue:** #3 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/3)
- **Estimated Effort:** 2h

## Requirements

- Record the architecture as reviewable Markdown artifacts before implementation branches diverge.
- Keep generated ripwire output limited to the two explicitly approved files.
- Use Mermaid for system, data-flow, access-log, and sequence diagrams, and for the data-model ER diagram generated from the Prisma schema.

## User Stories

- As a teammate, I want an architecture report and diagrams so that I can understand boundaries before editing code.
- As a reviewer, I want diagrams tied to the requirements so that missing flows are visible during pull requests.

## Purpose

Run ripwire early, while the repository is still small enough to inspect carefully. Use its
report and call graph as a review aid for architecture and file relationships, not as a
substitute for design decisions. ripwire is deterministic (no LLM pass, no API key) and
keeps its parse cache out of the repository.

## Required Outputs

- `ripwire-out/graph.html` - the browsable interactive call graph (self-contained, no CDN)
- `ripwire-out/GRAPH_REPORT.md` - the plain-language architecture report
- `docs/diagrams/system-context.md` - Markdown page with a fenced Mermaid system-context diagram (renders on GitHub)
- `docs/diagrams/data-flow.md` - Markdown page with a fenced Mermaid data-flow diagram showing SQL, API, blockchain access-log chain, and the two server nodes (renders on GitHub)
- `docs/diagrams/sequence-access-log.md` - Markdown page with a fenced Mermaid sequence diagram for a permitted read and its access-log propagation (renders on GitHub)
- `docs/diagrams/data-model.md` - Markdown page with a fenced Mermaid ER diagram generated from `prisma/schema.prisma` (renders on GitHub; no DBML — one source of truth)

ripwire's warm parse cache lives in `TMPDIR`, not the repository, so no other generated
state needs ignoring.

## Design

The diagrams must distinguish SQL medical data from blockchain access-log data and show both server nodes without implying that medical records are placed on-chain.

## Implementation Notes

1. Run ripwire (`npm run ripwire`) against the repository after the initial scaffold and inspect the report for unexpected coupling, missing links, or accidental sensitive files.
2. Re-run it after the first integrated feature milestone and before final submission.
3. Keep generated artifacts deterministic enough to review; record the command and ripwire version in the README.
4. Write each diagram as a Markdown page under `docs/diagrams/` with a fenced ```mermaid block — GitHub renders those directly, so they are the review copy. Never keep raw `.mmd` files as the canonical diagram.

## Done Criteria

- [x] `graph.html` and `GRAPH_REPORT.md` are present in `ripwire-out/` and are the only ripwire outputs tracked by Git
- [x] `git check-ignore` confirms ripwire cache/intermediate files are ignored (the cache lives in `TMPDIR`)
- [x] The three Mermaid diagrams render without syntax errors and match the implemented boundaries
- [x] `docs/diagrams/data-model.md` is generated from the approved Prisma schema and includes relationships/indexes
- [x] README links to every artifact and explains how to regenerate ripwire outputs
- [x] A short architecture review records at least one finding or explicitly says no findings were found

## Notes

Each diagram file follows the `docs/diagrams/task-dependencies.md` pattern: a short title, a sentence of context, and the fenced mermaid block. GitHub renders the mermaid block in the browser; nothing extra is needed.

- Re-run the review after the first integrated milestone and before submission.

## Questions to Resolve

- [x] Which ripwire version and command will be documented in the README? Answer: `npm run ripwire` (ripwire 0.5.0), see `docs/ripwire.md`.
