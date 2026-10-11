# Task: Database Design & Setup

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-09-07
- **Status:** DONE
- **Assignee:** matdevstamp
- **Tags:** database, backend, required, gate:2-scaffold
- **Dependencies:** 01-project-setup-group-contract.md, 02-database-choice-discussion.md, 03-ripwire-architecture-artifacts.md
- **Estimated Effort:** 4h
- **GitHub Issue:** #4 (https://github.com/matdevstamp/inl-3-awesome-journal/issues/4)


## Requirements

- Medical records stored in SQL database (NOT on blockchain - GDPR compliance)
- Support for 5 user roles with different access levels
- Patient data must be searchable by name
- Access logs generated to blockchain when data is viewed
- Notes with visibility categories (private, healthcare, all)
- `prisma/schema.prisma` is the **single source of truth** for the schema (kickoff decision — no DBML)
- A Mermaid entity-relationship diagram **generated from the Prisma schema** (checked in, never hand-edited)

## User Stories

### Data Storage
- **US-01:** As a system, I want to store medical records in a SQL database so that they're structured and queryable
- **US-02:** As a system, I want to NEVER store medical records on the blockchain so that we comply with GDPR
- **US-03:** As a system, I want to store access logs separately so that they can be synced to blockchain

### User Management
- **US-04:** As a system, I want to support 5 user roles so that each user has appropriate access
- **US-05:** As a system, I want to store user credentials securely so that authentication is safe
- **US-06:** As a system, I want to link users to organizations so that we can track which hospital/clinic they belong to

### Patient Data
- **US-07:** As a system, I want to store patient personal information so that we can identify them
- **US-08:** As a system, I want to support Swedish personal numbers so that we can uniquely identify patients
- **US-09:** As a system, I want to make patients searchable by name so that healthcare providers can find them

### Medical Records
- **US-10:** As a system, I want to store medical records with types so that we can categorize them
- **US-11:** As a system, I want to link records to patients and doctors so that we can track who created them
- **US-12:** As a system, I want to track record creation and update times so that we have an audit trail

### Notes
- **US-13:** As a system, I want to store notes with visibility levels so that we can control who sees them
- **US-14:** As a system, I want to link notes to records so that they're associated with the right patient data
- **US-15:** As a system, I want to track note authors so that we can show who wrote them

### Access Logs
- **US-16:** As a system, I want to log all access to patient data so that we have an audit trail
- **US-17:** As a system, I want to track which server processed the request so that we can sync between servers
- **US-18:** As a system, I want to mark logs as synced to blockchain so that we know what's been distributed

## Design

### Required Design Artifacts

- `prisma/schema.prisma` is the **only source of truth** — migrations and the Prisma client are generated from it.
- `docs/diagrams/data-model.md` is a Markdown page embedding the Mermaid ER diagram **generated from the Prisma schema**, so it renders on GitHub. Checked in, regenerated on every schema change, never hand-edited.
- The README describes the schema and links the diagram; migrations serve as the "CREATE script".
- No hand-written DBML — one source of truth avoids drift (kickoff decision).

Pin the ER-diagram generator inside `prisma/schema.prisma` so regeneration is automatic:

```prisma
generator erd {
  provider = "prisma-erd-generator"                       // dev dependency
  output   = "../docs/diagrams/data-model.md"             // .md = fenced mermaid block, renders on GitHub
}
```

With that block present, **every `npx prisma generate` rewrites `docs/diagrams/data-model.md`** — the same command that builds the Prisma client, so the diagram cannot drift from the schema. (Prisma ≥5 uses `prisma-erd-generator` v3; `.md` output is text-only and needs no `@mermaid-js/mermaid-cli`/Chromium.)

The Prisma schema targets PostgreSQL and includes enums for roles and note visibility, primary keys, foreign keys, indexes supporting patient-name search, and fictional seed data only.

### Database Schema

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('doctor', 'nurse', 'ambulance', 'patient', 'unauthorized') NOT NULL,
    organization_id INTEGER REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table (hospitals, clinics)
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) -- hospital, clinic, ambulance service
);

-- Patients table
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    personal_number VARCHAR(12) UNIQUE NOT NULL, -- Swedish personal number
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical records
CREATE TABLE medical_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    doctor_id INTEGER REFERENCES users(id),
    record_type VARCHAR(50), -- diagnosis, prescription, lab_result, etc.
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes with visibility control
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    record_id INTEGER REFERENCES medical_records(id),
    author_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    visibility ENUM('private', 'healthcare', 'all') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Access logs (will be synced to blockchain)
CREATE TABLE access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    patient_id INTEGER REFERENCES patients(id),
    record_id INTEGER REFERENCES medical_records(id),
    action VARCHAR(50), -- view, edit, create
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blockchain_synced BOOLEAN DEFAULT FALSE
);
```

### Indexes for Performance
```sql
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX idx_notes_record ON notes(record_id);
CREATE INDEX idx_access_logs_patient ON access_logs(patient_id);
```

## Tasks

- [x] Discuss and choose database system → PostgreSQL (task 02)
- [x] Prisma schema as single source of truth (no DBML — kickoff decision)
- [x] Generate database migrations from Prisma schema
- [x] Add appropriate indexes for search performance
- [x] Create seed data script with test users and patients
- [x] Add the `generator erd` block (above) to `prisma/schema.prisma` so `npx prisma generate` emits `docs/diagrams/data-model.md`
- [x] Document database structure in README (link diagram + migrations)
- [x] Test CRUD operations for all entities
- [x] Verify GDPR compliance (no medical records on blockchain)

## Done Criteria

- [x] All tables created with proper relationships
- [x] Indexes added for search operations
- [x] Seed data script works correctly
- [x] `data-model.md` regenerates automatically via `npx prisma generate` and renders on GitHub
- [x] Database documentation is complete
- [x] All team members can connect to database
- [x] CRUD operations tested for all entities

## Notes

- Medical records must NEVER be stored on blockchain (GDPR requirement)
- Access logs are the only things that go to blockchain
- Prisma is the ORM and the schema source of truth
- Make sure to handle Swedish personal numbers correctly
- Keep the Prisma schema, migrations, and generated diagram in one commit so they never drift

## Questions to Resolve

- [x] PostgreSQL vs SQLite? → **PostgreSQL** (see task 02-database-choice-discussion.md)
- [x] Prisma as single source of truth? → yes; DBML dropped
- [x] How to handle database seeding?
- [x] Do we need indexes for this project scale?
