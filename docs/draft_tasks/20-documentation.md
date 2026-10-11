# Task: Documentation & README

## Metadata
- **Priority:** P0 - Required throughout
- **Deadline:** 2026-09-29
- **Status:** IN PROGRESS
- **Assignee:** Kassim10
- **Tags:** documentation, readme, required, gate:5-delivery
- **Dependencies:** 01-project-setup-group-contract.md
- **GitHub Issue:** #30 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/30)
- **Related:** 03-ripwire-architecture-artifacts.md, 19-testing.md
- **Estimated Effort:** 4h

## Requirements

- README must include:
  - Project description
  - Screenshots of finished project
  - Installation/setup instructions
  - Database structure with CREATE script
  - Team member contributions
- Document at least 2 project meetings per week
- Every meeting note must include a short checkpoint against `docs/Raw_Requirements.md`
- Meeting notes must identify the facilitator, timekeeper, note-taker, decisions, blockers, and action-item owners. Attendance and absence may be recorded as `Not recorded` when the people affected have not consented to being identified.
- Update instructions as project progresses

Document the bug-report workflow: raw intake, lead triage, draft-task conversion, E2E reproduction, red/green fix progression, review evidence, and closure. The raw bug log must contain no patient data or secrets.

The examples in this task are optional documentation starters, not mandatory technology choices. The team may document equivalent commands and tools if a new teammate can reproduce the project.
- README must be usable by a new teammate on a clean machine, not merely describe the project
- README must link to the Prisma-generated Mermaid ER diagram (`docs/diagrams/data-model.md`), the other Mermaid architecture diagrams, API documentation (route-handler list), meeting notes, and ripwire report
- Document the deliberate privacy boundary: medical content remains in SQL; only access-log data is represented on the blockchain
- Include a reproducible demo script covering allowed and denied role flows, two servers, and live broadcasting

## User Stories

- As a new teammate, I want the README to take me from clean checkout to running demo without verbal instructions.
- As an examiner, I want requirements, database structure, screenshots, contributions, and evidence linked in one place.
- As a maintainer, I want meeting notes and decisions recorded so that project progress is auditable.

## Design

### README Structure

```markdown
# HealthAccess - Medical Records with Blockchain Access Logging

## Description
Brief description of the project and its purpose.

## Features
- Role-based access control (5 roles)
- Secure medical records storage
- Blockchain-based access logging
- Real-time updates via WebSocket
- P2P network for distributed access logs

## Screenshots
[Add screenshots here]

## Installation

### Prerequisites
- Node.js v18+
- PostgreSQL v14+
- npm or yarn

### Setup
1. Clone the repository
2. Install dependencies
3. Set up database
4. Configure environment variables
5. Start servers

## Database Structure
[Include CREATE script here]

## API Documentation
[Link to API docs or include here]


## Team
- Member 1: Role
- Member 2: Role
- Member 3: Role
- Member 4: Role

## Meeting Notes
[Link to meeting documentation]
```

### API Documentation

Document the HTTP surface of the route handlers under `src/app/api/` — one table with method, path, purpose, and required role per endpoint, plus where the shared request/response types live (`src/lib/types/api.ts`).

```markdown
## API Documentation

Route handlers live in the same Next.js app as the UI (no separate API server).

| Method | Path | Purpose | Roles |
|--------|------|---------|-------|
| POST | /api/auth/login | Log in, sets httpOnly JWT cookie | public |
| POST | /api/auth/logout | Clear session | any |
| GET  | /api/auth/me | Current user + role | any |
| GET  | /api/patients?name= | Search patients | doctor/nurse/ambulance |
| ...  | ... | ... | ... |
```

There is no OpenAPI/Scalar/generated-client toolchain in this project (kickoff decision: shared TypeScript types instead). If the team still wants an interactive reference later, it can be added without changing the architecture.

### Optional React Query Documentation Note

If React Query is selected, document the typed client setup, query-key conventions, cache invalidation after mutations, loading/error states, and any polling intervals. Shared types come from `src/lib/types/api.ts`; there is no generated file to regenerate.

### Meeting Documentation Template

```markdown
# Meeting Notes - [Date]

## Attendees
- [Names]

## Discussion
- [Topics discussed]

## Decisions Made
- [Decisions with rationale]

## Action Items
- [ ] Task 1 - Assignee
- [ ] Task 2 - Assignee

## Blockers
- [Any blockers encountered]

## Next Steps
- [What to work on next]
```

## Tasks

- [x] Write an initial README before feature work: purpose, scope, architecture, local setup placeholder, and team (initial slice 2026-09-04)
- [ ] Add installation, environment variables, database migration/seed, and two-server startup instructions
- [ ] Add database structure, generated data-model diagram link, and migration/seed regeneration instructions (including: `data-model.md` is emitted by the `generator erd` block in `prisma/schema.prisma`, so `npx prisma generate` refreshes it), plus the privacy boundary
- [ ] Add API and Mermaid diagram links, ripwire report link, screenshots, and demo script
- [ ] Keep README and meeting notes current at each weekly review
- [ ] Keep a requirements traceability section current: requirement, implementation/task, test or demo evidence, owner, status
- [ ] Re-read `docs/Raw_Requirements.md` before the final README and presentation review
- [ ] Perform a clean-machine walkthrough and have a teammate follow the README without verbal help
- [ ] Add installation instructions
- [ ] Document database structure
- [ ] Add CREATE script for database
- [ ] Create meeting notes template
- [ ] Document at least 2 meetings per week
- [ ] Add screenshots of finished features
- [ ] Document API endpoints
- [ ] Create troubleshooting guide
- [ ] Add team member contributions
- [ ] Update README as project progresses

## Done Criteria

- [ ] README has clear project description
- [ ] Installation instructions work from scratch
- [ ] Database structure is documented
- [ ] CREATE script recreates database
- [ ] Screenshots show finished features
- [ ] Meeting notes are documented (min 2/week)
- [ ] Team contributions are listed
- [ ] API documentation is complete
- [ ] Troubleshooting guide exists
- [ ] Documentation is up-to-date

## Notes

- Update README weekly as features are added
- Take screenshots regularly
- Keep meeting notes concise but informative
- Document any deviations from original plan
- Include known issues and limitations

## Questions to Resolve

- [ ] Which screenshot tool to use?
- [x] How detailed should API documentation be? → route-handler table in README
- [x] Should we use a documentation generator? → no (shared types; kickoff)
- [x] How to format meeting notes consistently? → `YYYY-MM-DD-<meeting-type>.md`; use the structure in [`docs/MEETING_TEMPLATE.md`](../MEETING_TEMPLATE.md) and keep raw transcripts in `docs/meetings/archive/`.
