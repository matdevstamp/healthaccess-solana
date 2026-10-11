# Task: Testing & Quality Assurance

## Metadata
- **Priority:** P1 - High
- **Deadline:** 2026-09-23
- **Status:** DONE
- **Assignee:** Team
- **Tags:** testing, quality, required, gate:5-delivery
- **Dependencies:** 17-user-roles-access-control.md, 15-blockchain-access-logging.md, 16-p2p-network.md, 18-socketio-broadcasting.md
- **GitHub Issue:** #29 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/29)
- **Related:** 09-playwright-e2e-testing.md, 20-documentation.md
- **Estimated Effort:** 8h

## Requirements

- Work test-driven (TDD recommended)
- Test all critical paths
- Test role-based access control

## Bug-Fix Workflow

Use `docs/bug-reports.csv` as a lightweight raw intake log. The lead triages each report and converts valid defects into a draft task or GitHub issue. For a user-visible defect, reproduce the behavior with a focused Playwright E2E test before fixing it: the test is **red** for the known failure, the implementation fix makes it **green**, and the test remains in CI as regression protection.

Do not put patient data, credentials, tokens, or other secrets in the raw report. Use fictional identifiers and sanitized evidence only.

## User Stories

- As a team, we want tests for every required role and visibility rule so that regressions are caught before the demo.
- As a reviewer, I want tests for URL tampering and the SQL/blockchain boundary so that the most serious risks are explicit.
- As a contributor, I want focused test commands so that I can validate a stream before opening a PR.

## Test-First Checkpoint

- Before coding each feature, add at least one acceptance test for the required happy path and one denial, validation, or failure case.
- Keep tests close to the behavior they protect: backend policy tests for authorization and visibility, frontend tests for rendering and interactions, and Playwright tests for complete user journeys.
- A failing test is acceptable while a feature is being started; a task is not done until its focused tests are green and included in CI.
- Test blockchain integrity
- Test P2P synchronization
- Document test results

## Design

### Testing Strategy

```
Testing Levels:
├── Unit Tests (70%)
│   ├── Database queries
│   ├── Authentication logic
│   ├── Access control logic
│   └── Utility functions
├── Integration Tests (20%)
│   ├── API endpoints
│   ├── Database operations
│   └── Socket.io events
└── E2E Tests (10%)
    ├── Login flow
    ├── Patient search
    ├── Note creation
    └── Access logging
```

### Test Cases by Feature

#### Authentication & Access Control
```
✅ Test login with valid credentials (all 5 roles)
✅ Test login with invalid credentials
✅ Test access to protected routes without token
✅ Test role-based access (doctor vs patient vs unauthorized)
✅ Test patient cannot access other patients' data
✅ Test URL manipulation prevention
✅ Test token expiration handling
```

#### Patient Search
```
✅ Test search by name (first, last, partial)
✅ Test search with Polish characters (ł, ż, ó)
✅ Test search with pagination
✅ Test search with filters
✅ Test empty search results
✅ Test search performance with large dataset
```

#### Medical Notes
```
✅ Test note creation with all visibility levels
✅ Test private notes only visible to author
✅ Test healthcare notes visible to healthcare staff
✅ Test "all" notes visible to patients
✅ Test note editing by author
✅ Test note deletion with confirmation
✅ Test note access logging
```

#### Blockchain & P2P
```
✅ Test access log creation
✅ Test blockchain integrity verification
✅ Test blockchain sync between servers
✅ Test tamper detection
✅ Test P2P communication
✅ Test server disconnection handling
✅ Test data consistency after reconnection
```

### Test Data Setup

```javascript
// Test users
const testUsers = {
    doctor: { username: 'dr_test', password: 'test123', role: 'doctor' },
    nurse: { username: 'nurse_test', password: 'test123', role: 'nurse' },
    ambulance: { username: 'amb_test', password: 'test123', role: 'ambulance' },
    patient: { username: 'patient_test', password: 'test123', role: 'patient' },
    unauthorized: { username: 'unauth_test', password: 'test123', role: 'unauthorized' }
};

// Test patients
const testPatients = [
    { id: 1, name: 'Anna Kowalska', personalNumber: '198503151234' },
    { id: 2, name: 'Mark Thompson', personalNumber: '199207225678' }
];
```

## Tasks

- [x] Set up testing framework (Vitest for unit/integration, Playwright for E2E)
- [x] Write unit tests for authentication
- [x] Write unit tests for access control
- [x] Write integration tests for API endpoints
- [x] Write tests for patient search
- [x] Write tests for medical notes
- [x] Write tests for blockchain operations
- [x] Write tests for P2P synchronization
- [x] Create test data fixtures
- [x] Set up CI/CD pipeline for automated testing
- [x] Document test results
- [x] Fix any failing tests

## Done Criteria

- [x] Testing framework is set up
- [x] Unit tests cover critical logic
- [x] Integration tests cover API endpoints
- [x] All 5 roles are tested
- [x] Access control is thoroughly tested
- [x] Blockchain integrity is verified
- [x] P2P sync is tested
- [x] Test coverage is at least 70% (99.13% statements)
- [x] All tests pass
- [x] Test results are documented
- [x] CI/CD pipeline runs tests automatically

## Test Results

Recorded 2026-09-29 on branch `feature/19-testing-qa`.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run test:unit` | Vitest, watch-less unit + integration run |
| `npm run test:unit:coverage` | Vitest with coverage thresholds (70% gate) |
| `npm run test:e2e` | Playwright against two built servers (3001/3002) |
| `npm run check` | Lint + format check + typecheck |
| `npm run build` | Production build used by the E2E web servers |

Playwright boots `next start`, so `npm run build` must succeed first. Locally,
stale servers are reused (`reuseExistingServer: !process.env.CI`); kill a
leftover `next start` process or run with `CI=1` after changing server code.

### Results

| Suite | Result |
| --- | --- |
| Vitest | 25 files, 334 tests passing |
| Coverage | 99.13% statements, 97.55% branches, 100% functions, 99.13% lines |
| Playwright | 106 tests passing, 0 skipped |
| `npm run check` | clean |
| `npm run build` | clean, no warnings |

Coverage is collected from `src/lib/**/*.ts` and `src/app/api/**/route.ts`.
Excluded from the report (not exercised as application code): `prisma.ts`,
`socket-server.ts`, the interface-only `blockchain/access-log.ts` and
`p2p/message.ts`, and all test files.

### Scope note: record creation

No test asserts that a medical record can be created. The specifications ask
for note creation, not record authoring:

- `docs/Raw_Requirements.md` — staff add a "note" and choose its visibility.
- `docs/draft_tasks/14-medical-notes.md` — "create a note with an explicit visibility level".
- `docs/draft_tasks/12-frontend-ui.md` US-06/07/08 — records are read-only
  ("I want to see ..."), with no create/edit requirement.

`e2e/records/view.spec.ts` therefore covers reading records only. Note creation,
editing and deletion are covered in `e2e/notes/visibility.spec.ts` and
`e2e/realtime/notes.spec.ts`.

### Defects found and fixed by this task

- **JWT claims leaked** — `/api/auth/me` returned the raw token payload,
  including `iat`/`exp`. `toSessionUser` in `src/lib/auth.ts` now projects a
  validated `SessionUser`.
- **Visibility policy ignored authorization** — `canViewNote` filtered by role
  and visibility but never checked that the viewer may read the patient, so an
  unauthorized user could read notes marked `all`. It now requires the
  `readPatient` permission.
- **Relayed P2P logs were rejected** — `sendAccessLogToPeer` stamped the
  forwarding server in the envelope's `from`, but the peer requires
  `from === data.serverId`. Any log a server re-pushed after a sync failed with
  HTTP 400. `from` now names the originating server.
- **Duplicate logs returned 400** — re-delivery is now an idempotent no-op
  (`200`, `stored: false`) via a `"stored" | "duplicate" | "rejected"` result
  from `Peer.receiveAccessLog`.
- **Edge-runtime build warning** — `instrumentation.ts` statically imported
  `node:http` (via `socket-server.ts`) into the Edge instrumentation bundle.
  Node-only bootstrap moved to `instrumentation-node.ts` behind a
  `NEXT_RUNTIME` guard.
- **Flaky chain-equality assertion** — `e2e/blockchain/p2p.spec.ts` compared two
  servers' chains for exact array equality while sibling suites appended to
  them in parallel. It now compares event-id sets after a settle round-trip.

## Notes

- Focus on testing security-critical paths first
- Use mock data for consistent testing
- Test edge cases and error conditions
- Document any known issues or limitations
- Consider using test databases separate from development

## Questions to Resolve

- [x] Which testing framework to use? → Vitest (unit/integration) + Playwright (E2E), matching task 09.
- [x] How to set up test database? → Docker Postgres via `e2e/global-setup.ts`, migrated and seeded per run.
- [x] Should we implement E2E tests with Cypress? → No, Playwright was already chosen in task 09.
- [x] How to handle socket.io testing? → Two `next start` instances (3001/3002) with real Socket.io ports; cross-server delivery is asserted over a WebSocket client.
