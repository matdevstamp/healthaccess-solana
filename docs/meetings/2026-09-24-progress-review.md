# Meeting Notes - 2026-09-24

- **Meeting type:** Progress review
- **Facilitator:** Not recorded
- **Timekeeper:** Not recorded
- **Note-taker:** MatDevstamp
- **Attendees:** Not recorded
- **Absent:** Not recorded

## Agenda

1. Check the previous action items.
2. Review the relevant sections of `docs/Raw_Requirements.md`.
3. Discuss progress, decisions, blockers, and risks.
4. Assign next actions with one owner and a due date each.
5. Read back decisions and confirm the next meeting.

## Meeting Scope Policy

Organization/primary care centre governance and the other deferred areas were kept outside the current Task 17 merge.

| Parked topic | Why separate time is needed | Required participants | Owner | Proposed meeting | Decision needed |
|---|---|---|---|---|---|
| Organization/primary care centre governance | It requires separate scope and must not expand the current PR | Relevant stream owners | Project lead | After the Task 17 merge | Create a follow-up branch from `main` and define the work |
| Audit logging, role changes, and session timeout | These are separate follow-up changes | Relevant backend/frontend owners | Project lead | After the Task 17 merge | Define tasks, owners, and acceptance criteria |

## Previous Actions

| Action | Owner | Status | Follow-up |
|---|---|---|---|
| Finish Task 18 | Real-time owner | In progress | Complete the implementation tonight and update the review evidence |
| Address Task 17 review comments and prepare the PR for merge | Authorization owner | In progress | Push the next update and keep the current PR focused |
| Review and merge Task 17 when ready | Review owner | Pending | Review the updated PR and merge after the agreed checks are complete |

## Requirements Checkpoint

| Raw requirement or section | Covered by task/PR/test/demo | Status | Missing evidence or next action |
|---|---|---|---|
| Role-based access and authorization | Task 17 PR | In progress | Add or update the permission tests and complete the review |
| JWT-based frontend flow | Task 17 PR | In progress | The frontend integration will be fixed in the current PR |
| Two-server Socket.IO broadcasting | Task 18 | In progress | Finish the implementation and provide the reviewable result |
| Organization/primary care centre boundary | Deferred follow-up | Unclear | Define the boundary and acceptance criteria in a separate task after the merge |
| Audit logging, role changes, and session timeout | Deferred follow-up | Missing evidence | Create separate tasks with named owners |
| Documented meetings | This note | Covered | Continue documenting at least two meetings per week |

## Discussion and Decisions

- Task 18 has started and is expected to finish tonight.
- Task 17 was reported fixed and pushed. All checks were reported green, the PR was ready for a new review, and no blockers were reported at the time of the meeting.
- The Task 17 review comments are being addressed and the next update will be pushed. The goal is for Task 17 to be ready for merge by Friday evening.
- The current Task 17 PR will also include the JWT-based frontend, permission rules, and additional tests.
- Organization/primary care centre scope stays outside the current merge. Audit logging, role changes, and session timeout are handled separately.
- The team will fix the remaining agreed items in the current PR first, merge Task 17, and then create a follow-up branch from the updated `main` for the later work.
- The resolved portions of Task 17 and the sequence for completing the remaining work were discussed.

## Blockers and Risks

| Blocker or risk | Impact | Owner | Next action | Due |
|---|---|---|---|---|
| No blocker reported for the current Task 17 PR | None currently | Authorization owner | Keep addressing review comments and push the update | 2026-09-25 |
| Deferred scope could expand the current merge | Larger review surface and delayed merge | Project lead | Keep organization governance, audit logging, role changes, and session timeout out of this PR | Current merge |
| Task 18 is still in progress | The two-server broadcasting evidence is not yet complete | Real-time owner | Finish Task 18 and provide the reviewable result | 2026-09-24 |

## New Action Items

| Action | Owner | Due | Related task or requirement |
|---|---|---|---|
| Finish Task 18 and update its review evidence | Real-time owner | 2026-09-24 | Task 18 and Socket.IO requirements |
| Address the Task 17 review comments, fix the JWT frontend, permission rules, and tests, then push the update | Authorization owner | 2026-09-25 | Task 17 and authorization requirements |
| Review the updated Task 17 PR and merge when the agreed checks are complete | Review owner | After the update is pushed | Task 17 / Gate 4 |
| Create a follow-up branch from the updated `main` for organization governance and the other deferred areas | Project lead | After the Task 17 merge | Deferred scope |

## Closing Check

- **What changed since the last meeting?** Task 18 was started, and the Task 17 PR was reported fixed and pushed with green checks and no blockers.
- **What is the next smallest demonstrable outcome?** A review-ready Task 17 PR containing the agreed frontend, permission, and test changes, followed by a completed Task 18 implementation.
- **What must be re-checked against the raw requirements before the next meeting?** Server-side authorization, permission tests, two-server Socket.IO behavior, and the medical-data privacy boundary.
- **Next meeting:** To be confirmed after the Task 17 update; facilitator and timekeeper not recorded; note-taker MatDevstamp.
