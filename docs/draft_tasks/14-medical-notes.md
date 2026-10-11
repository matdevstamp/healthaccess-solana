# Task: Medical Notes with Visibility Control

## Metadata
- **Priority:** P1 - High
- **Deadline:** 2026-09-22
- **Status:** IN PROGRESS
- **Assignee:** Kassim10 (backend visibility) + rcilomba (UI)
- **Tags:** frontend, notes, visibility, required, gate:3-features, stream:C-notes
- **Dependencies:** 04-database-design.md, 11-backend-api-auth.md, 12-frontend-ui.md
- **GitHub Issue:** #16 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/16)
- **Related:** 13-patient-view-search.md
- **Estimated Effort:** 5h

## Requirements

- Users can add notes to patient records
- Notes have 3 visibility levels:
  - Private: Only visible to author
  - Healthcare: Visible to doctors, nurses, ambulance
  - All: Visible to everyone with access (including patient)
- Notes are saved and displayed in patient view
- Access to notes is logged

React Query is an optional way to coordinate note queries and mutations. If used, request and response types come from the shared types module (`src/lib/types/api.ts`) — no generated client. The route handlers (backend) still decide which note content is visible.

## User Stories

- As healthcare staff, I want to create a note with an explicit visibility level so that sensitive information reaches only the intended audience.
- As a patient, I want to see notes marked `all` and know that protected notes exist without reading their content.
- As the system, I want note creation and viewing to produce access evidence so that journal use can be audited.

## Test-First Checkpoint

- Write visibility tests before implementing note creation: private, healthcare-only, and all-users cases.
- Include the patient view assertion that protected note content is absent while permitted notes remain visible.

## Design

### User Stories

- As healthcare staff, I want to create a note with an explicit visibility level so that sensitive information reaches only the intended audience.
- As a patient, I want to see notes marked `all` and know that other notes exist without reading their protected content.
- As the system, I want note creation and viewing to produce access evidence so that later review can identify who accessed the journal.

### Visibility Decision Table

```mermaid
flowchart LR
  N[Note request] --> V{Visibility}
  V -- private --> A[Author only]
  V -- healthcare --> H[Healthcare roles]
  V -- all --> E[Everyone already authorized]
  A --> G[Filter before response]
  H --> G
  E --> G
  G --> L[Log journal access]
```

### Visibility Levels

```
Private (private):
├── Author can see
├── Other doctors cannot see
├── Nurses cannot see
├── Ambulance cannot see
├── Patient cannot see
└── Access is logged

Healthcare (healthcare):
├── Author can see
├── Other doctors can see
├── Nurses can see
├── Ambulance can see
├── Patient CANNOT see (but sees that a note exists)
└── Access is logged

All (all):
├── Author can see
├── Other doctors can see
├── Nurses can see
├── Ambulance can see
├── Patient CAN see
└── Access is logged
```

### Note Creation Interface

```
┌─────────────────────────────────────┐
│ Add Note to Patient: Anna Kowalska  │
├─────────────────────────────────────┤
│ Note Content:                       │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │ Patient shows signs of...       │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Visibility:                         │
│ ○ Private (only me)                 │
│ ● Healthcare (doctors, nurses)      │
│ ○ All (everyone with access)        │
│                                     │
│ [Cancel] [Save Note]                │
└─────────────────────────────────────┘
```

### Note Display

#### For Healthcare Staff
```
┌─────────────────────────────────────┐
│ Notes for Anna Kowalska             │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Note by Dr. S. Berg (Private)   │ │
│ │ 2024-01-15 10:30                │ │
│ │ Patient shows signs of anxiety  │ │
│ │ [Edit] [Delete]                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Note by Nurse Karlsson (All)    │ │
│ │ 2024-01-15 14:20                │ │
│ │ Patient blood pressure normal   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [+ Add Note]                        │
└─────────────────────────────────────┘
```

### Optional Note Mutation Example

```tsx
const queryClient = useQueryClient();

const createNote = useMutation({
  mutationFn: (input: CreateNoteInput) => api.createNote(patientId, input),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ['patient-notes', patientId],
    });
  },
});
```

Show `isPending`, `isError`, and the server error message in the form. Do not infer hidden-note visibility only from cached client data.

#### For Patient
```
┌─────────────────────────────────────┐
│ My Notes                            │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Note by Nurse Karlsson (All)    │ │
│ │ 2024-01-15 14:20                │ │
│ │ Patient blood pressure normal   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ℹ️ 2 notes exist but are private    │
└─────────────────────────────────────┘
```

## Tasks

- [x] Create note creation form with visibility selector
- [ ] Implement note route handlers (CRUD) under src/app/api/notes
- [ ] Add visibility-based filtering in the route handlers (backend)
- [x] Create note display component
- [x] Implement role-based note visibility
- [x] Add note count indicator for hidden notes
- [ ] Log note access to the access-log chain
- [ ] Add note editing functionality
- [ ] Add note deletion with confirmation
- [ ] Handle edge cases (empty notes, long text)

## Done Criteria

- [ ] Notes can be created with 3 visibility levels
- [ ] Private notes only visible to author
- [ ] Healthcare notes visible to healthcare staff
- [ ] "All" notes visible to patients too
- [ ] Patients see count of hidden notes
- [ ] Note access is logged to the access-log chain
- [ ] Notes can be edited by author
- [ ] Notes can be deleted with confirmation
- [x] UI clearly shows note visibility level
- [ ] All note operations are logged

## Notes

- Consider adding rich text editing for notes
- Make sure to handle markdown or formatting
- Add character limit for notes (e.g., 1000 chars)
- Consider adding timestamps and edit history
- Log all note operations for audit trail
- UI delivered in PR #25 (merged): note creation form + 3-level visibility selector (mock/local until API ready), note display with visibility badge, role-based note filtering and hidden-note count (`hiddenNotesCount`). Backend `src/app/api/notes|records` are still `notImplemented` stubs — CRUD, server-side visibility filtering and audit logging remain (tracked by task 11 auth + this task). Note: issue #16 was closed after PR #25; reopen if full backend notes CRUD is expected.

## Questions to Resolve

- [ ] Should notes support rich text or plain text only?
- [ ] What's the character limit for notes?
- [ ] Should we show edit history for notes?
- [ ] How to handle note deletion (soft delete vs hard delete)?
