# HealthAccess Project Plan

**Deadline:** Friday, October 2, 2026 at 11:00  
**Team:** 4 developers  
**Working rule:** app code (Next.js/TS, Prisma/DB schema, config) goes to `main` only through a PR with 1 review; everything under `docs/` and the Python tooling (`project_management/`) may push directly (kickoff decision).

## North Star

Deliver one reliable, demonstrable flow:

1. A user logs in with one of five roles.
2. An authorized healthcare user searches for a patient and opens the journal.
3. The server stores medical data in SQL, never on the blockchain.
4. Every journal access creates an access-log entry that is distributed across two running servers and represented in the blockchain.
5. Notes obey private, healthcare-only, and all-users visibility rules.
6. The patient sees their own permitted notes and the complete access-log view; unauthorized users see only an access-denied page.

The project must also leave behind understandable evidence: a working README, meeting notes, a Prisma schema with migrations, a generated Mermaid ER diagram, API documentation, tests, screenshots, and the two approved ripwire artifacts.

## Requirements Loop

`docs/Raw_Requirements.md` is the controlling source for scope. The team must deliberately loop back to it throughout the project instead of treating the initial planning meeting as a one-time requirements read.

- At every planning meeting, review the raw requirements and confirm that the next tasks map to a named requirement.
- At least twice per week, use a short requirements checkpoint in the meeting notes: `covered`, `unclear`, `missing evidence`, and `next action`.
- Every feature PR links its acceptance criteria to the relevant raw-requirements section and states which requirement is still not covered, if any.
- For every user-facing behavior, write or update an acceptance test before implementation. The test may initially fail, but it must express the intended behavior and the raw requirement it covers.
- At each weekly demo, walk through the required user flow and compare the result against the raw requirements, not only against the task board.
- Before integration, testing, and submission, perform a full checklist pass over the raw requirements and record the result in a meeting note or release checklist.
- If a proposed feature is not required and risks delaying the required flow, defer it until the MVP is demonstrably complete.

## Operating Model

### Roles

The kickoff (2026-09-04) deviated from the example Person 1–4 split in `docs/Raw_Requirements.md` — the contract now records real roles: **backend (Kassim)**, **UI (Ramadan)**, **coordinator/lead + Gate 2 setup (Matias)**, and **Stream D owner (Najma)**. Najma declared her focus on 2026-09-05: main responsibility for blockchain/access-logging (task 15), pair-programming on P2P (16) and Socket.IO (18). Ramadan keeps task 12 (Frontend UI). The A–D feature streams remain the mapping target; backup/review pairs across backend/UI.

| Team member | Area | Streams |
|---|---|---|
| Matias (`matdevstamp`) | Coordinator/Lead; Gate 2 setup (tasks 04–10); docs | — |
| Kassim (`Kassim10`) | Backend — route handlers, DB access, auth, auditLogger | A/B/C (backend) |
| Ramadan (`rcilomba`) | UI — task 12 (login, dashboard-shell, access-denied), pages, components, shadcn, search/view | A/B/C (frontend), D-vy |
| Najma (`umoraghad0-del`) | Blockchain/access-logging (chain core, task 15); pair P2P (16) & Socket.IO (18) | D |

Gate 1 tasks (01–03) are Team-owned; the lead coordinates. Gate 2 scaffold is owned by Matias, pairing with Kassim/Ramadan where needed. No feature branch should create a competing root package, app shell, configuration, or directory layout.

### Collaboration Rules

- Each feature has one primary owner and one reviewer from another stream.
- Keep shared files stable: `package.json`, lockfiles, routing entry points, API schemas, Prisma schema, and global styles are changed only through an explicit reviewed integration task.
- Use short-lived branches named `feature/<task-id>-<topic>` or `chore/<task-id>-<topic>`.
- Open a draft PR early; merge only when CI passes and the assigned reviewer has approved it.
- Hold at least two documented project meetings per week. Every meeting note records decisions, blockers, owners, and next steps.
- Rotate facilitator, timekeeper, and note-taker roles so the operational work is shared. The note-taker publishes the meeting note in `docs/meetings/` the same day.
- Use [MEETING_TEMPLATE.md](MEETING_TEMPLATE.md) for every planning meeting, standup, review, and retrospective.
- Demo a thin vertical slice at the end of every week; unfinished work is re-scoped against the MVP instead of silently carried forward.

The default rotation is alphabetical by person each week: the next person facilitates, the following person keeps time, and the third person takes notes. A swap is fine, but the meeting note records the actual assignments. Replace temporary labels with real names in the group contract.

## Dependency Gates

The task dependency graph is generated from the draft-task metadata and renders automatically on GitHub — GitHub does not render raw `.mmd` files, so the generator writes a markdown page instead. The single rendered copy is [docs/diagrams/task-dependencies.md](diagrams/task-dependencies.md): open that file on GitHub and the diagram displays itself, no manual copying needed.

Regenerate it whenever task metadata changes:

```bash
python3 -m project_management plan graph --output docs/diagrams/task-dependencies.md
```

The same command with a `.mmd` suffix writes the raw Mermaid source instead (for tools that read plain Mermaid). Do not paste a second copy of the graph into this or any other file.

No stream starts until Gate 1 is met. Database-dependent backend work starts only after Gate 2. Cross-stream integration starts only after each stream has a reviewed contract and a narrow test.

## Ordered Work

### Gate 1: Decisions, contract, and repository hygiene
**September 2-7 | Team (lead coordinates)**

1. **01** - Sign `gruppkontrakt.md`, agree on roles, meetings, PR review, branch rules, and definition of done.
2. **02** - Decide PostgreSQL for the shared two-server scenario; record the rejected alternatives and local setup decision.
3. **03** - Run ripwire on the initial repository and check in only `ripwire-out/graph.html` and `ripwire-out/GRAPH_REPORT.md`. Create the Mermaid system-context, data-flow, and access-log sequence diagrams.
4. **20 (initial slice)** - Create the README skeleton, project purpose, architecture links, setup placeholder, team section, and meeting-note index.

**Gate 1 exit:** By end of Mon Sep 7 — contract agreed, GitHub rules active, decisions written, README points to planned artifacts, ripwire ignore policy tested.

The Gate 1 meeting note must also contain the first requirements checkpoint against `docs/Raw_Requirements.md`.

### Gate 2: Scaffold and executable contracts (compressed)
**September 7-8 | Matias leads (pairs with Kassim/Ramadan); team reviews**

5. **04** - Create the Prisma schema (single source of truth), migration strategy, fictional seed data, and the generated Mermaid ER diagram as `docs/diagrams/data-model.md` (Markdown page wrapping the Mermaid block so GitHub renders it; emitted from the Prisma schema).
6. **05, 06, 07, 08, 09, 10** - Build one Next.js fullstack app (UI + route handlers in the same app), strict TypeScript, lint/format, Playwright runner and fixtures, CI, environment examples, and local commands.
7. **09 first test** - Before feature implementation, write the first Playwright smoke test for the login page/app shell. Run it red if the page does not exist yet, then keep it as the first green scaffold gate.
8. Define the shared request/response types and typed fetch helpers before feature streams fork (no OpenAPI/generated-client toolchain — the UI and API share one TypeScript codebase). Add health checks and a minimal page-to-route-handler request.

**Gate 2 exit:** By end of Tue Sep 8 — clean checkout installs, lint/typecheck/build pass, both server instances start on ports 3001/3002, database migration/seed works, README setup steps work for one teammate.

⚠️ **This gate is compressed.** Matias leads the setup with Kassim/Ramadan pairing in; everything (04–10) lands by Tue Sep 8 so the feature streams start Wed Sep 9.

Run a second raw-requirements checkpoint at this gate and remove or re-plan anything that does not support the required demo.

### Gate 3: Four parallel feature streams
**September 9-16 | Four owners, separate files and branches**

| Stream | Primary tasks | Contract to freeze |
|---|---|---|
| A - Identity | **11**, authentication hooks/pages | login response, session/token behavior, five role enum values |
| B - Patient access | **13**, patient search and patient view | patient search and record response shapes |
| C - Notes and records | **14**, record display and note creation | note visibility enum and filtering rules |
| D - Audit distribution | **15**, **16**, blockchain access log and two-server P2P transport | append-only log payload, server identity, chain verification |

> **Superseded (hackathon).** Stream D described the original in-memory chain
> and its P2P replication of the access log. The hackathon replaced both: the
> trail now lives in the Solana program `healthaccess_audit` (a rolling
> `head_hash` on a single `AuditTrail` PDA), and the two servers share that
> chain instead of syncing a private copy. The access-log P2P routes were
> removed. See `docs/hackathon/INTERFACE-CONTRACT.md`.

UI work may use fixtures typed from the shared `src/lib/types/api.ts` module. Backend work may use seeded data. Owners do not edit another stream's files without a review note and an integration branch.

Every stream follows the same small loop: write acceptance cases, implement the smallest behavior, run the focused test, then refactor only after it is green. The first test cases must cover the requirement's happy path and one relevant denial or error path.

### Gate 4: Authorization and real-time integration
**September 17-21 | Team integration pairings**

8. **17** - Centralize authorization policy and verify every route server-side; URL manipulation must never expose another patient's data.
9. **18** - Connect Socket.IO broadcasting so a note written on server 1 appears on server 2 only for users allowed to see it.
10. Run the vertical demo: login, search, view, note visibility, access denied, blockchain log, and two-server propagation.

**Gate 4 exit:** the vertical flow works on a clean database with two server processes, and integration bugs have owners in the board.

Compare the working vertical flow line by line with `docs/Raw_Requirements.md` before declaring this gate complete.

### Gate 5: Evidence, regression, and delivery
**September 22-29 | Team**

⚠️ **Buffer:** Oct 1-2 is for final fixes and submission. Do not plan new features after Sep 24 — QA runs Sep 23-24, then docs and demo rehearsal close the gate.

11. **19** - Unit/integration tests for policy, visibility, URL tampering, access-log creation, and blockchain immutability boundary.
12. **09** - Expand the early Playwright setup into critical role-based flows and the two-server demo; capture stable screenshots.
13. **20 (final slice)** - Complete README: prerequisites, commands, environment variables, migrations, generated schema diagram, other diagrams, ripwire regeneration, screenshots, API link, privacy boundary, team contributions, demo script, and meeting notes.
14. **21** - Rehearse the ten-minute presentation, explain four genuine challenges and solutions, verify the public/collaborator repository requirement, and perform the final GitHub checkout test.

**Submission gate:** `main` is green, the repository contains no secrets or medical data, required artifacts are linked, at least two meetings per week are documented, and the exact demo works before class.

The final checklist must include a signed-off raw-requirements pass, with evidence links for every required behavior and a named owner for every remaining risk.

## MVP Cut Line

Protect these first: five-role login, patient search, journal view, server-side authorization, visibility-filtered notes, SQL storage, blockchain access logging, two servers, and basic Socket.IO propagation. Defer advanced styling, passwordless login/passkeys, performance work, and nonessential blockchain features until the MVP demo is reliable.

## Required Artifact Locations

- `gruppkontrakt.md` (root)
- `README.md`
- `docs/diagrams/*.md` (Mermaid diagrams rendered as Markdown pages on GitHub: `task-dependencies.md` auto-generated from draft tasks, `data-model.md` generated from `prisma/schema.prisma`, and the architecture pages `system-context.md`, `data-flow.md`, `sequence-access-log.md` from task 03; raw `.mmd` sources may exist but are never the review copy)
- `docs/meetings/*.md`
- `ripwire-out/graph.html`
- `ripwire-out/GRAPH_REPORT.md`
- `prisma/schema.prisma`

## Sources Consulted

- [npm workspaces documentation](https://docs.npmjs.com/cli/v11/using-npm/workspaces) - root-managed workspace commands and dependency linking.
- [Prisma documentation](https://www.prisma.io/docs) - schema, migrations, and the ER-diagram generator.
- [prisma-erd-generator](https://github.com/keonik/prisma-erd-generator) - a `generator erd` block in the Prisma schema that emits `docs/diagrams/data-model.md` (fenced Mermaid block) on every `npx prisma generate`.
- [GitHub rulesets documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) - branch and push controls for the PR-only workflow.
- [Mermaid documentation](https://mermaid.js.org/intro/) - repository-readable diagrams and supported diagram syntax.