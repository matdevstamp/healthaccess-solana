# Task: Project Setup & Group Contract

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-09-04
- **Status:** DONE
- **Assignee:** Team
- **Tags:** setup, documentation, required, gate:1-decisions
- **Dependencies:** None
- **GitHub Issue:** #1 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/1)
- **Estimated Effort:** 2h

## Requirements

- Group contract must be written before starting the project
- Repository must be set up on GitHub (public or invite postmodernistx as collaborator)
- README must exist with project description
- Agile workflow must be established from start
- `docs/Raw_Requirements.md` must be established as the scope authority and reviewed continuously
- Each meeting must have an assigned facilitator, timekeeper, and note-taker
- A shared agenda and meeting-note template must be agreed before feature work begins

## User Stories

- As a team member, I want clear roles, meeting rules, and a PR workflow so that collaboration is predictable.
- As a project, we want the raw requirements and definition of done recorded before coding so that scope decisions are visible.

## Design

### Group Contract Template
The contract should cover:
- Team member roles and responsibilities
- Communication channels and meeting schedule
- Decision-making process
- Code review and PR workflow
- Conflict resolution

### Repository Structure
```
├── docs/           # requirements, meetings, diagrams, draft tasks
├── src/            # one Next.js (fullstack) app per server
│   ├── app/        # App Router pages + route handlers (src/app/api/...)
│   └── lib/        # shared TS types, Prisma client, blockchain, P2P
├── prisma/         # Prisma schema + migrations (single schema source of truth)
├── README.md
└── gruppkontrakt.md
```

> **Stack (kickoff 2026-09-04):** fullstack **Next.js** — UI and API route handlers live in the same TypeScript app, run twice (ports 3001/3002) for the P2P demo. No separate Vite frontend or Express backend.

## Tasks

- [x] Create GitHub repository
- [x] Write gruppkontrakt.md using provided template
- [x] Add the per-member loggbok files under `docs/logbooks/` (or the format the group decides at kickoff) — later removed from the fork to reduce noise (see task 36)
- [x] Record branch rule (app code via PR + 1 review; docs/ + Python tooling push direct) and apply the GitHub ruleset later with task 10
- [x] Create README.md with initial project description
- [x] Set up project board (GitHub Projects or similar)
- [x] Establish meeting schedule (min 2 standups/week)
- [x] Assign the first meeting facilitator and note-taker; define a rotation for later meetings
- [x] Add the meeting agenda and note template from `docs/MEETING_TEMPLATE.md`
- [x] Add a requirements-checkpoint agenda item to every planning meeting and at least two meetings per week
- [ ] Create a lightweight requirements traceability checklist linking each requirement to a task and later evidence
- [x] Define PR review process (min 1 review; nobody reviews/merges their own PR — not even the lead; no fixed review time-frame) — decided at kickoff, in gruppkontrakt §7/§9
- [x] Set up development environment instructions

## Done Criteria

- [x] gruppkontrakt.md exists and is committed
- [x] Logbook format decided at kickoff and each member's logbook file existed in `docs/logbooks/` (since removed)
- [x] README.md exists with project description
- [x] Repository is public or postmodernistx is collaborator
- [x] Branch protection rules are configured
- [x] All team members have access
- [x] Meeting schedule is documented
- [x] Requirements checkpoint format is documented and used in the first meeting note
- [x] Meeting role rotation is documented and every scheduled meeting has an owner for facilitation and notes

## Notes

- The group contract should be specific enough to be actionable
- Consider using a template from the course resources
- Make sure everyone signs/agrees to the contract
- Re-read `docs/Raw_Requirements.md` before finalizing the contract so the workflow reflects the actual assignment

## Questions to Resolve

- [x] Frontend: React inside Next.js (fullstack) — decided at kickoff
- [x] Auth: JWT in an httpOnly cookie — decided at kickoff
- [x] Blockchain: simple custom chain (stream D split TBD) — decided at kickoff
- [x] Database: PostgreSQL (dev + prod) — decided at kickoff
