# Task: Patient View & Search

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-09-15
- **Status:** DONE
- **Assignee:** rcilomba
- **Tags:** frontend, patient, search, required, gate:3-features, stream:B-patient
- **Dependencies:** 04-database-design.md, 11-backend-api-auth.md, 12-frontend-ui.md
- **GitHub Issue:** #15 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/15)
- **Related:** 14-medical-notes.md
- **Estimated Effort:** 6h

## Requirements

- Search functionality for patients by name
- Patient view varies based on logged-in role
- Patients can only see own data (no URL manipulation)
- Unauthorized users see "Access Denied"
- Search should be efficient and user-friendly

React Query is an optional fit for patient search and journal data. If used, query functions should consume the shared API types from `src/lib/types/api.ts` (no generated client — kickoff decision), query keys should describe the request parameters, and authorization must remain entirely on the backend.

## User Stories

- As healthcare staff, I want to search patients by name so that I can find the correct journal quickly.
- As a patient, I want direct access to my own journal without a search flow so that another patient's ID cannot expose my data.
- As a user, I want the journal view to match my role so that forbidden actions and information are not shown.

## Test-First Checkpoint

- Write tests for an authorized name search, an empty result, and a patient being refused access to another patient's identifier.
- Assert both the backend response and the visible frontend state where the behavior crosses the API boundary.

## Design

### User Stories

- As healthcare staff, I want to search patients by name so that I can find the correct journal quickly.
- As a patient, I want to be routed directly to my own journal so that I do not need, and cannot use, a search flow for another patient.
- As a user, I want the patient view to reflect my role so that actions and data are understandable without exposing forbidden controls.

### Search-to-Journal Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend
    participant API as Backend API
    participant DB as SQL database
    participant Chain as Access-log chain
    User->>UI: Submit patient name
    UI->>API: GET /patients?name=query
    API->>API: Authenticate and authorize search
    API->>DB: Search fictional patient data
    DB-->>API: Matching patients
    API-->>UI: Filtered result list
    User->>UI: Select patient
    UI->>API: GET /patients/:id/journal
    API->>API: Validate role and ownership
    API->>DB: Load permitted journal data
    API->>Chain: Append access log
    DB-->>API: Filtered records and notes
    API-->>UI: Role-specific journal view
```

### Search Interface

```
┌─────────────────────────────────────┐
│ Search Patients                     │
├─────────────────────────────────────┤
│ [________________________] [Search] │
│                                     │
│ Filters:                            │
│ ☑ Name  ☑ DOB  ☑ Personal Number   │
│                                     │
│ Results:                            │
│ ┌─────────────────────────────────┐ │
│ │ Anna Kowalska                   │ │
│ │ DOB: 1985-03-15                 │ │
│ │ Records: 5 | Last visit: 2024-01│ │
│ └─────────────────────────────────┘ │
│                                     │
│ Pagination: [1] [2] [3] ... [10]   │
└─────────────────────────────────────┘
```

### Patient Detail View

#### Doctor View
```
┌─────────────────────────────────────┐
│ Patient: Anna Kowalska              │
│ DOB: 1985-03-15 | ID: 12345        │
├─────────────────────────────────────┤
│ Tabs: [Records] [Notes] [Access]   │
├─────────────────────────────────────┤
│ Medical Records:                    │
│ ┌─────────────────────────────────┐ │
│ │ 2024-01-15: Annual checkup     │ │
│ │ Doctor: Dr. Svensson            │ │
│ │ [View Details]                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [+ Add New Record]                  │
└─────────────────────────────────────┘
```

#### Patient View (Own Data)
```
┌─────────────────────────────────────┐
│ My Health Record                    │
├─────────────────────────────────────┤
│ Tabs: [My Records] [My Access Log] │
├─────────────────────────────────────┤
│ My Medical Records:                 │
│ ┌─────────────────────────────────┐ │
│ │ 2024-01-15: Annual checkup     │ │
│ │ [View Details]                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Access Log:                         │
│ ┌─────────────────────────────────┐ │
│ │ 2024-01-15 10:30 - Dr. Svensson│ │
│ │ viewed your records             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Search Algorithm

```javascript
// Backend search with fuzzy matching
async function searchPatients(query, filters) {
    const searchQuery = `
        SELECT * FROM patients 
        WHERE (
            LOWER(first_name) LIKE LOWER($1) OR
            LOWER(last_name) LIKE LOWER($1) OR
            personal_number LIKE $1
        )
        ORDER BY last_name, first_name
        LIMIT $2 OFFSET $3
    `;
    
    const results = await db.query(searchQuery, [
        `%${query}%`,
        limit,
        offset
    ]);
    
    return results;
}
```

### Optional Patient Query Example

First, keep the shared types behind a small API module:

```tsx
// src/lib/api/client.ts
import type { Patient } from '@/lib/types/api';

export const api = {
    searchPatients: (params: { name?: string; page?: number; filters?: string[] }) =>
        fetchJson<Patient[]>(`/api/patients?${new URLSearchParams(params as any)}`),
    getPatientJournal: (patientId: string) => fetchJson(`/api/patients/${patientId}/journal`),
};
```

The important pattern: shared types supply the shapes and the feature component calls `api.searchPatients` instead of constructing raw URLs. When the patient endpoint changes, update the shared types + route handler together in the same app.

```tsx
import type { Patient, JournalView } from '@/lib/types/api';

type PatientSearchResponse = Patient[];

const patientsQuery = useQuery({
    queryKey: ['patients', { name: debouncedName, page, filters }],
    queryFn: () => api.searchPatients({ name: debouncedName, page, filters }),
    enabled: debouncedName.trim().length >= 2,
});

const journalQuery = useQuery<JournalView>({
    queryKey: ['patient-journal', patientId],
    queryFn: () => api.getPatientJournal(patientId),
    enabled: Boolean(patientId),
});
```

Never put permissions in a query key or assume that changing a URL protects patient data. The API must authenticate, authorize, and filter every request.

## Tasks

- [x] Create patient search component
- [x] Implement search route handler with pagination (src/app/api/patients)
- [x] Add search filters (name, DOB, personal number)
- [x] Create patient journal view component (src/app/patients/[id])
- [x] Implement role-based view switching
- [x] Add patient ownership validation
- [x] Create "Access Denied" page
- [x] Implement search result highlighting
- [x] Add loading states for search
- [x] Handle empty search results gracefully
- [ ] Add keyboard navigation for search

## Done Criteria

- [x] Search returns correct results by name
- [x] Pagination works correctly
- [x] Filters narrow down search results
- [x] Patient view adapts to user role
- [x] Patients can only see own data
- [x] URL manipulation is prevented
- [x] "Access Denied" page shows for unauthorized
- [x] Search is fast and responsive
- [x] Empty states are handled properly
- [ ] Keyboard navigation works

**Optional (descoped 2026-09-15):** keyboard navigation for search results — nice-to-have, not required for issue completion. Delivered by PR #24 (squash commit `227fc0c`).

## Notes

- Delivered by PR #24 (squash commit `227fc0c`, merged 2026-09-15); issue #15 closed as completed.
- Consider implementing debounced search for better UX
- Use React Router for patient detail navigation
- Make sure to sanitize search input to prevent SQL injection
- Consider adding recent searches feature
- Add keyboard shortcuts for power users

## Questions to Resolve

- [ ] How to handle Polish characters in search? (ł, ż, ó)
- [ ] Should we implement autocomplete for search?
- [ ] What's the optimal page size for search results?
- [ ] Should we cache search results?
