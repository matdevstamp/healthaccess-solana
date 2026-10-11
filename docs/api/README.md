# Backend API

The backend API is implemented with Next.js Route Handlers under `src/app/api`.

The API uses JSON for request and response data. Authentication is handled with a JWT stored in an httpOnly cookie.

## Authentication

### POST /api/auth/login

Logs in a user with username and password.

The system supports the following roles:

- doctor
- nurse
- ambulance
- primary_care
- patient
- unauthorized

On successful login, a JWT token is created and stored in an httpOnly cookie. The token contains information about the authenticated user, including role and organization.

Passwords are verified securely with bcrypt.

Incorrect username or password returns the same error message so as not to reveal whether a particular user exists in the system.

### POST /api/auth/logout

Logs out the current user by removing the authentication cookie.

### GET /api/auth/me

Returns information about the currently authenticated user.

The endpoint requires a valid authenticated session.

## Patients

### GET /api/patients?q={query}&filter={filter}&page={page}

Patient search reads from SQL and requires a valid JWT cookie. Mock role headers are not accepted.
`filter` supports `name` (default), `dob`, and `personalNumber`; repeated filters use OR matching.
Names match case-insensitively, including full names. Date prefixes use `YYYY`, `YYYY-MM`, or
`YYYY-MM-DD`. Personal numbers can include a hyphen. The legacy `name` query parameter is supported.
Pages contain three results in stable name/ID order; pages beyond the last page are clamped.
Invalid filters or page numbers return 400. Missing sessions return 401; forbidden roles return 403.
The response uses `PatientSearchResponse` in `src/lib/types/api.ts`. Note counts exclude other
authors' private notes. `lastVisit` is the latest record creation date, or `-` when no records exist.

Searches for patients based on name.

Allowed roles:

- doctor
- nurse
- ambulance
- primary_care

The following roles do not have access to patient search:

- patient
- unauthorized

The endpoint is protected server-side with role-based access control.

## Health

### GET /api/health

Returns information about the API, the peer server, and the Solana connection.

The response contains `solana` with:

- `reachable` — whether the RPC endpoint responds
- `cluster` — `SOLANA_CLUSTER`
- `programId` — configured program id, or `null`
- `programDeployed` — `false` as long as `SOLANA_PROGRAM_ID` is empty
- `headHash` — the chain's current head, or `null`
- `currentSlot` — current slot as a decimal string
- `pendingEvents` — number of outbox rows waiting to be anchored
- `error` — error message if something went wrong, otherwise `null`

The endpoint never crashes on an unreachable chain; it reports the state.

## Journals

### GET /api/patients/:id

Returns the patient and journal view from SQL. Requires a JWT cookie and the role `doctor`,
`nurse`, `ambulance`, `primary_care`, or `patient`.

The patient role may only open their own patient ID.

The response follows `PatientJournalResponse` in `src/lib/types/api.ts`.

The visibility of notes is controlled by their `visibility`:

- `private` is shown only to the author
- `healthcare` is shown to healthcare staff
- `all` can be shown to authorized users, including the patient

A patient is informed that healthcare notes exist, but not their content.

An invalid ID returns 400, a missing session 401, denied access 403, and an unknown patient ID 404.
The patient's link to the user ID is validated through the relationship between `User` and
`Patient` in the database (`users.patient` ↔ `patients.user_id`). The view's audit events
are handled separately by the access-log API.

## Notes

Notes are linked to medical records and have three
visibility levels:

- `private`
- `healthcare`
- `all`

Notes are stored in the SQL database and never contain patient data on the blockchain.

The API uses shared TypeScript types in:

`src/lib/types/api.ts`

The implementation and visibility checks are in:

- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`

### GET /api/notes

Fetches notes that the user has permission to see.

Access is checked server-side based on the authenticated user's
role and the note's visibility level.

### POST /api/notes

Creates a new note.

The endpoint requires authentication and checks the user's permission before the
note is created.

### PATCH /api/notes/:id

Updates an existing note after a server-side permission check.

### DELETE /api/notes/:id

Deletes an existing note after a server-side permission check.

## Access logs

Access logs record every access to patient data and act as a
durable outbox: the row is first written to SQL with `status = pending`, and a
background process (the flusher) then anchors it to the Solana program
`healthaccess_audit`. When a row is anchored, it carries Solana's `slot`, `signature`
and the `head_hash` it committed to.

Medical information is never stored on the blockchain — only pseudonymized
access events (patient and user IDs are salted and hashed before they are encoded).

The implementation is in `src/lib/outbox/` (store, flusher, verify) and
`src/lib/solana/` (encoding, PDA, chain reads). There is no longer any P2P sync of the
access log: the chain is the shared state and Postgres is the shared
mirror.

### GET /api/access-log

Returns `accessLogs`, `actors` (usernames per id, looked up at read time),
`viewerUserId`, and a `verification` block:

- `localHead` — the mirror's computed head
- `chainHead` — the chain's current head
- `match` — whether the mirror still matches the chain
- `checkedAt` — timestamp

The verification is reported, never thrown: a patient asking whether their log
is intact should get an answer even when the answer is negative or the RPC is unavailable.

Requires `readAccessLogs`, that is, `doctor`, `nurse`, `ambulance`, `primary_care`,
or `patient`. A `patient` gets only logs for their own `patientId` (filtered
in the database query); healthcare staff get all. Without a valid session `401`, without the right
permission `403`.

### GET /api/records

Exists as a route but is not implemented and returns `501 Not Implemented`.
The feature belongs to Task 14.

## P2P endpoints

Server-to-server communication between the project's two instances. These routes
do **not** use the user's JWT session.

### POST /api/p2p/note

Receives a note notification from the peer server and forwards it to the
other instance's clients. The message is validated structurally before it
is accepted.

> The access log is **no longer** synchronized between the servers. The previous
> `GET`/`POST /api/p2p/access-log` routes were removed: the chain is the shared
> state now, and both servers read and write against the same program. See
> `docs/hackathon/INTERFACE-CONTRACT.md`.

### Peer authentication

The P2P route requires the `x-peer-secret` header with the correct value. The check is done by
`isPeerAuthorized()` in `src/lib/p2p/peer-auth.ts`:

| Route                | Auth requirement              |
| -------------------- | ----------------------------- |
| `POST /api/p2p/note` | `x-peer-secret`, otherwise `401` |

The value is read from `PEER_SECRET` (default `dev-peer-secret-change-me`) and must
be identical in both instances.

## Roles and permissions

The system has six roles:

| Role         | Description               |
| ------------ | ------------------------- |
| doctor       | Doctor                    |
| nurse        | Nurse                     |
| ambulance    | Ambulance staff           |
| primary_care | Primary care staff        |
| patient      | Patient                   |
| unauthorized | User without permission   |

Protected API routes check authentication and permission server-side with
`requirePermission()`. The permission matrix is in `src/lib/auth/permissions.ts`; the database stores
the user's role and organization link, but not a separate list of permissions.

| Role         | Patient search | Journals            | Create/edit own notes         | Access logs               |
| ------------ | -------------- | ------------------- | ----------------------------- | ------------------------- |
| doctor       | All patients   | All patients        | Yes                           | All logs                  |
| nurse        | All patients   | All patients        | Yes                           | All logs                  |
| ambulance    | All patients   | All patients        | Yes                           | All logs                  |
| primary_care | All patients   | All patients        | Yes                           | All logs                  |
| patient      | No             | Own journal only    | No                            | Own patient logs only     |
| unauthorized | No             | No                  | No                            | No                        |

### Primary care centre

The raw requirement counts primary care centre as one of five user roles. It is therefore implemented as the role
`primary_care` with the same clinical permissions as hospital staff, because the spec does not give
primary care centre any unique permissions of its own.

Two things are true at the same time, and it is easy to confuse them:

- **The primary care centre is an organization.** It exists as `Organization.type = "clinic"` and staff are
  linked to it via `User.organizationId`. The demo user `vc_test` belongs to `Ekfors Primary Care Centre`.
- **Primary care staff are a login role.** `primary_care` grants the same access as `doctor`,
  `nurse`, and `ambulance`.

That the role has the same permissions as hospital staff is a deliberate choice, not an oversight. No
organization-based filtering is implemented, so `primary_care` sees the same patients as other
staff. Restricting access to the primary care centre's own patients is a possible follow-up, but
it is a feature the requirement does not describe and it has not been done.

The role was added via `ALTER TYPE "Role" ADD VALUE 'primary_care'`, see
`prisma/migrations/20261001000000_add_primary_care_role`.

A missing or invalid JWT session returns `401`. An authenticated user without the right permission returns
`403`. Patients trying to open another patient ID are stopped both by the API and by the frontend before
journal data is fetched. Mock headers never grant permission.

## JWT and session management

JWT is used for authentication.

The token is stored in an httpOnly cookie and is therefore not directly accessible from JavaScript in the browser.

The cookie also uses:

- `httpOnly`
- `sameSite: lax`
- `secure` in production
- `path: /`

The JWT is verified server-side before protected resources may be used.

## Standard API responses

Successful requests use the following structure:

```json
{
  "ok": true,
  "data": {}
}
```

Errors use the following structure:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

This makes API routes use a consistent format for both successful requests and errors.

## Validation

Request data is validated with Zod before it is processed.

For example, login credentials are validated before the user is looked up in the database.

Invalid request data returns an appropriate 4xx response.

## Rate limiting

The login endpoint uses rate limiting to reduce the risk of abuse and repeated login attempts.

When the limit is exceeded, the HTTP status returned is:

`429 Too Many Requests`

## CORS

The API allows the two local origins used by the project's demo servers:

- `http://localhost:3001`
- `http://localhost:3002`

Unknown origins are not allowed.

Credentials are supported because authentication uses an httpOnly cookie.

## Page protection

Next.js `proxy.ts` is used to stop unauthenticated requests to protected pages before the page loads.

API routes still perform their own authentication and permission checks server-side.

The proxy layer therefore does not replace the security checks in the API.

## Shared API types

Shared TypeScript types for the API contract are in:

`src/lib/types/api.ts`

Among other things, the following are defined there:

- user roles
- note visibility levels
- session user
- standard API responses
- login request
- login response
- health response

The project uses shared TypeScript types instead of an OpenAPI-generated client because the frontend and backend live in the same Next.js application.

## Tests

The backend's authentication and security features are tested with Playwright.

Tests exist for, among other things:

- successful login
- incorrect login credentials
- all five user roles
- validation of login data
- logout
- `/api/auth/me`
- patient search and role check
- rate limiting
- CORS
- protection of authenticated pages

Test data is fictional and is created through the project's seed script.
