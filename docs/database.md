# Database Documentation

## Overview

HealthAccess uses PostgreSQL as its SQL database and Prisma as its ORM.

The data model is defined in:

`prisma/schema.prisma`

The Prisma schema is the project's **single source of truth** for the data model.

A Mermaid ER model is generated automatically from the Prisma schema and is here:

[Data model (ER)](diagrams/data-model.md)

The diagram should not be edited manually. It is regenerated when `npx prisma generate` runs.

---

## Privacy boundary

Medical data is stored only in the SQL database.

The blockchain does not contain patient journals or other medical information. Only information linked to access logs is represented on the blockchain.

This means:

- Patient data is stored in PostgreSQL.
- Medical records are stored in PostgreSQL.
- Notes are stored in PostgreSQL.
- Access logs are stored in PostgreSQL as a durable outbox and then anchor to the Solana program `healthaccess_audit`.
- Medical information is never sent to the blockchain.

---

## Database tables

### `organizations`

Represents organizations that users belong to, for example hospitals, clinics, or ambulance organizations.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | Primary key |
| `name` | String | Organization name |
| `type` | String? | Organization type |

An organization can have multiple users.

---

### `users`

Contains the system's users and their roles.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | Primary key |
| `username` | String | Unique username |
| `password_hash` | String | Hashed password |
| `role` | Role | The user's role |
| `organization_id` | Integer? | Link to organization |
| `created_at` | DateTime | Created at |
| `updated_at` | DateTime | Last updated |

The roles are:

- `doctor`
- `nurse`
- `ambulance`
- `primary_care`
- `patient`
- `unauthorized`

---

### `patients`

Contains the patients' basic information.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | Primary key |
| `personal_number` | String | Swedish personal identity number |
| `first_name` | String | First name |
| `last_name` | String | Last name |
| `date_of_birth` | Date | Date of birth |
| `created_at` | DateTime | Created at |

`personal_number` is unique.

Patients can have multiple medical records and multiple access logs.

---

### `medical_records`

Contains medical records.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | Primary key |
| `record_type` | String | Type of medical record |
| `content` | String | Medical content |
| `patient_id` | Integer | Patient the medical record belongs to |
| `author_id` | Integer | The user who created the medical record |
| `created_at` | DateTime | Created at |
| `updated_at` | DateTime | Last updated |

Medical records are stored **only in the SQL database**.

---

### `notes`

Contains notes linked to medical records.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | Primary key |
| `content` | String | The note's content |
| `visibility` | NoteVisibility | The note's visibility level |
| `record_id` | Integer | Medical record the note belongs to |
| `author_id` | Integer | The user who created the note |
| `created_at` | DateTime | Created at |
| `updated_at` | DateTime | Last updated |

The visibility levels are:

- `private`
- `healthcare`
- `all`

---

### `access_logs`

Contains audit/access logs for access to patient data. The table is
at the same time the **durable outbox** that the flusher drains against the Solana program, and
the **off-chain mirror** of the chain that `/api/access-log` verifies.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | Primary key |
| `event_id` | String? | Stable ID shared with the peer and with the broadcast payload (unique) |
| `action` | String | For example view, edit, or create |
| `server_id` | String | The server that handled the event |
| `user_id` | Integer | The user who performed the action |
| `actor_role` | String | Role at enqueue time (snapshot, not a live read) |
| `patient_id` | Integer | Affected patient (**deliberately no foreign key**, see below) |
| `record_id` | Integer? | Affected medical record |
| `status` | String | `pending` → `anchored` when the program returns a signature; `failed` is terminal |
| `slot` | BigInt? | Solana slot (BigInt: slots exceed `Number.MAX_SAFE_INTEGER`) |
| `signature` | String? | The transaction signature, `null` until anchored |
| `head_hash` | String? | The chain head the event was anchored on (hex) |
| `attempt` | Integer | Number of flush attempts, makes the retry behavior observable |
| `error` | String? | Why the last attempt failed |
| `claimed_at` | DateTime? | When a flusher took the row, so a crashed process does not strand it forever |
| `client_time` | DateTime | The client's time; the chain's slot is the trusted clock |
| `created_at` | DateTime | Time of the event |

`actor_role` is a snapshot of the user's role **at enqueue**, not a
live read of `users.role`. The chain payload is built from this column, so a
later role change must not silently re-sign the same event with a different
role.

`patient_id` is **not** a foreign key. The audit trail must survive a
patient being deleted, and an FK would then either delete rows or block
the deletion — both destroy the evidentiary value.

Access logs are used to be able to trace access to patient data.

Only the access log's pseudonymized information is represented on the blockchain.
The patient's medical content is not stored on the blockchain.

---

## Enums

### `Role`

Allowed roles:

- `doctor`
- `nurse`
- `ambulance`
- `primary_care`
- `patient`
- `unauthorized`

### `NoteVisibility`

Allowed visibility levels for notes:

- `private`
- `healthcare`
- `all`

---

## Relationships

The database uses foreign keys for the relationships between the tables.

### Organization → User

An organization can have multiple users.

`Organization 1 ──── * User`

### Patient → MedicalRecord

A patient can have multiple medical records.

`Patient 1 ──── * MedicalRecord`

### User → MedicalRecord

A user can create multiple medical records.

`User 1 ──── * MedicalRecord`

### MedicalRecord → Note

A medical record can have multiple notes.

`MedicalRecord 1 ──── * Note`

### User → Note

A user can create multiple notes.

`User 1 ──── * Note`

### User → AccessLog

A user can have multiple access logs.

`User 1 ──── * AccessLog`

### Patient → AccessLog

A patient can have multiple access logs.

`Patient 1 ──── * AccessLog`

The relationship is **logical, not a foreign key**: `access_logs.patient_id` has no FK,
so a deleted patient cannot delete or block their audit rows.

### MedicalRecord → AccessLog

A medical record can be linked to multiple access logs.

`MedicalRecord 1 ──── * AccessLog`

---

## Indexes and constraints

The database uses constraints and indexes for data integrity and efficient searching.

### Unique

The following fields are unique:

- `users.username`
- `patients.personal_number`
- `access_logs.event_id`

### Index

The following indexes are used:

- `patients(last_name, first_name)`
- `medical_records(patient_id)`
- `notes(record_id)`
- `access_logs(patient_id)`
- `access_logs(status, id)` — drives the outbox flusher's queue of `pending` rows

Foreign keys are used between related tables to ensure referential integrity.

---

## Migrations

The initial database migration is here:

`prisma/migrations/20260904_init/migration.sql`

The migration contains, among other things:

- PostgreSQL schema
- enums
- tables
- indexes
- foreign keys

The migration also serves as the project's reproducible SQL/create script for the initial database.

For a new environment, saved Prisma migrations should be used instead of manually creating tables.

---

## Database setup

After the project's dependencies and environment variables have been configured, the database can be started with:

```bash
npm run db:up
```

Apply saved migrations:

```bash
npm run db:deploy
```

or use the development migration:

```bash
npm run db:migrate
```

Seed data can be created with:

```bash
npm run db:seed
```

The Prisma client and the ER diagram are generated with:

```bash
npx prisma generate
```

## Seed data

The project uses fictional test data.

The seed script is in:

`prisma/seed.js`

Seed data is used, among other things, to test:

- authentication
- different user roles
- patient search
- journal views
- medical notes
- permission checks
- access logs
- the Solana anchoring flow

No real patient data should be used in the project.

---

## Source of truth

The data model should be changed through:

`prisma/schema.prisma`

After changes, Prisma migrations and the generated ER diagram should be updated.

The generated model is here:

[Data model (ER)](diagrams/data-model.md)

The SQL migrations are here:

[Prisma migrations](../prisma/migrations/)
