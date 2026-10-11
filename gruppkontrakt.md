# Group Contract — Inl 3 Group Assignment (HealthAccess)

> **Status:** v0.4 — signed by Matias Fri 4 Sep (covers the kickoff decisions: roles, branch rule, PR review, schedule); the others sign no later than Sat 5 Sep. Najma (`umoraghad0-del`) was not at the kickoff and declared her focus afterwards (5 Sep): **main responsibility for blockchain/access-logging (Stream D, task 15)** + pair programming on P2P (16) and Socket.IO (18). Ramadan keeps task 12 (Frontend UI).
> Template: [Group contract template](https://gist.github.com/postmodernistx/6afcbe224bce912a6da1a86b8b94adbc) · Scope: [`docs/Raw_Requirements.md`](docs/Raw_Requirements.md)

## Team

| Name | GitHub | Role |
|---|---|---|
| Matias Marti | `matdevstamp` | Coordinator / Lead (focus on Gate 1–2) |
| Kassim Segerberg | `Kassim10` | Backend (API routes, DB/Prisma, middleware); stream D chain core open |
| Ramadan | `rcilomba` | UI / Frontend (all UI, stream D view TBD) |
| Najma Hasan | `umoraghad0-del` | Blockchain/access-logging (Stream D main responsibility, task 15); pair on P2P (16) & Socket.IO (18) |

## 1. Project & level of ambition

We are building HealthAccess: a system where medical records are stored in a SQL database and every record access is logged to a blockchain, distributed across two servers (P2P). We work according to `docs/PROJECT_PLAN.md` with a PR-only workflow and at least **2 documented meetings per week** in the repository (course requirement).

- **Level of ambition:** TBD (proposal: G with margin — working demo of the whole flow + polished documentation)
- **Requirements on ourselves:** TBD

## 2. Roles & areas of responsibility

We deviate from the example distribution Person 1–4 in `docs/Raw_Requirements.md` — instead we share backend/UI/coordination (decision at the kickoff on 4 Sep, see `docs/meetings/2026-09-04-kickoff.md`). Stream D (chain core + P2P) was assigned to Najma on 5 Sep (see the status line above).

| Person | Area of responsibility | Streams |
|---|---|---|
| Kassim Segerberg (`Kassim10`) | Backend: Next.js API routes, database & Prisma, middleware, `auditLogger` | A/B/C (backend) |
| Ramadan (`rcilomba`) | Frontend/UI: task 12 (login, dashboard shell, access denied), record search/view, live access-log view, verification badge | A/B/C (frontend), D view |
| Matias Marti (`matdevstamp`) | Coordinator/Lead: meetings, PR review, unblocking, Gate 1–2 | — |
| Najma Hasan (`umoraghad0-del`) | Blockchain/access-logging (chain core, task 15); pair on P2P (16) & Socket.IO (18) | D (chain core + P2P) |

- **Scrum master:** TBD (we can rotate)
- **Lead:** Matias Marti (`matdevstamp`)
- **Backup/review:** backend ↔ UI pair (Kassim ↔ Ramadan); Matias's PRs are reviewed by whoever knows the area best. Stream D code (blockchain/P2P/Socket.IO) is reviewed by Najma together with backend (Kassim).

## 3. Previous group work experience

> Fill in at the kickoff. Top 3 worst experiences + negative expectations, per person.

- Kassim: ____
- Ramadan: ____
- Najma: ____
- Matias: Unclear division of responsibility (diffuse ownership → things fall between the cracks); everything is postponed to the last day → panic at the end

## 4. Meeting times & format

Fixed recurring schedule: **2 meetings/week — Tuesdays and Thursdays** (times are filled in at the kickoff — locked once everyone has filled in [`docs/team-availability.md`](docs/team-availability.md)):

- **Meeting 1 — Tuesday:** quick sync, blockers (standup)
- **Meeting 2 — Thursday:** progress review (+ sprint planning/retro as needed)
- Meeting notes go into `docs/meetings/` using [`docs/MEETING_TEMPLATE.md`](docs/MEETING_TEMPLATE.md), the same day.
- Facilitator/timekeeper/note-taker rotate (alphabetical order per week by default).
- Every meeting includes a requirements checkpoint against `docs/Raw_Requirements.md`.

## 5. Meeting channels & communication

- **Channel:** Microsoft Teams ✓
- **Camera:** TBD (recommendation: on)
- **Prepared or shared walkthrough:** TBD
- **Response time for messages:** TBD
- **Unavailability is announced:** TBD (how early?)
- **Urgent matters:** TBD (SMS/phone?)

## 6. Logbook & documentation

We keep a **logbook per person** for daily standups and meeting attendance. (The per-member logbooks were later removed from the hackathon fork to reduce noise; see task 36.)

- **Default (proposal):** one CSV per person in `docs/logbooks/` — checked into the repository (the directory was later removed from the fork; see task 36).
- **Decision at kickoff:** CSV (repo) **or** Excel/Sheets externally. If we choose externally, an **owner other than Matias** is required: ____
- The note-taker for the week's meetings documents the daily/standup in the repository (rotate preferably).

## 7. Task distribution & workflow

- Nothing is committed directly to `main` — everything goes via a **PR** with at least **1 review**. **Exception (decision at kickoff):** everything under `docs/` (markdown, CSV, diagrams, `.mmd` etc.) and the Python tool (`project_management/`) may be pushed directly to `main`; all app code (Next.js/TS, Prisma/DB schema, config) requires a PR + review.
- **No one reviews or merges their own PR** — not even the lead: Matias's app code is reviewed by someone else on the team (whoever knows the area best: Kassim for backend, Ramadan for UI, Najma where she is involved).
- Branch names: `feature/<task-id>-<topic>` or `chore/<task-id>-<topic>`.
- Tasks are broken down to ~half a day's work and taken from draft tasks/issues; if you take on a task outside the standup, you mention it at the next one.
- We resolve code conflicts together with whoever owns the files (shared files are only changed via a reviewed integration task).
- **Definition of done:** PR merged + CI green + reviewer approved + meeting note/requirements checkpoint updated.

## 8. Code standard

- **Commits:** ____ (proposal: Conventional Commits)
- **Lint/format:** ESLint + Prettier (see draft tasks 07–08)
- **Language in code (identifiers, comments):** ____
- **Branch protection:** enforce PR reviews on `main` for app code; everything under `docs/` + `project_management/` may be pushed directly

## 9. Feedback & follow-up

- Code reviews are done on PRs, deadline: **no fixed deadline** — the reviewer responds as soon as possible
- Feedback on design/UI: ____
- Deadline for follow-up on what someone has done: ____

## 10. Personality type, stress & roles

> Fill in at the kickoff — how do you react under stress? Which role do you usually take (leader, planner, expert, finisher, reviewer, …)?

- Kassim: Finisher
- Ramadan: ____
- Najma: ____
- Matias: Finisher — focuses and gets things done under stress

## 11. Other expectations & consequences

- How active should one be? Announce unavailability in advance on Teams; active in meetings and in the logbook (proposal from the lead, confirmed on signing)
- Consequences if someone does not show up/does their part: a softer line (proposal from the lead) — first a chat in the group, the teacher is only contacted on repeated absence/missing work.
- What are you good at / less good at? What do you want to practise extra (HTML/CSS/git/project management/…)?
  - Matias: Good at code; wants to practise PM/facilitation/coordination

## 12. Other

- (Own headings/agreements we want to add — e.g. working hours, weekend policy, AI usage.)

## 13. Signatures

We have read and approve the group contract:

| Name | GitHub | Date | Signature |
|---|---|---|---|
| Matias Marti | `matdevstamp` | 2026-09-04 | ✅ (v0.3) |
| Kassim Segerberg | `Kassim10` | 2026-09-05 | ✅ (v0.3) |
| Ramadan Cilomba | `rcilomba` | 2026-09-05 | Approves (v0.3) |
| Najma Hasan | `umoraghad0-del` | 2026-09-14 | ✅ |
