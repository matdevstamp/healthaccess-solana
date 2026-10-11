# Data Flow

Two tracks that must not be conflated: **medical data (SQL)** and the
**access log (Solana)**. Medical data is read from and written to PostgreSQL
and never leaves it. Each read also enqueues an access event, which a
background flusher commits to the program.

```mermaid
flowchart LR
    subgraph Client["Browser"]
        UI["React / Next.js UI<br/>(shadcn/ui)"]
    end

    subgraph S1["Next.js server"]
        AUTH["Auth<br/>(JWT httpOnly cookie,<br/>role checks)"]
        API["Route handlers"]
        LOG["Access logging"]
        OUT["Outbox<br/>(pending → anchored / failed)"]
        FLUSH["Flusher<br/>re-reads head each attempt"]
    end

    DB[("PostgreSQL<br/>medical data + access_logs")]
    PROG["Solana program<br/>record_access"]
    TRAIL[("AuditTrail PDA<br/>head_hash")]

    UI -->|request + cookie| AUTH
    AUTH -->|authorized role| API
    API -->|"SQL: journal / search / notes"| DB
    DB -->|"medical data — stays in SQL"| API
    API -->|response data| UI

    API -->|every record access| LOG
    LOG -->|"enqueue (pseudonymised event)"| OUT
    OUT --> DB
    FLUSH -->|"prev_hash = current head"| PROG
    FLUSH -->|signature + slot| OUT
    PROG -->|"head = sha256(prev ‖ borsh(event))"| TRAIL
    TRAIL -->|read head| AUTH
    DB -->|"mirror vs chain"| API

    style DB fill:#e8f0fe
    style PROG fill:#fde8e8
    style TRAIL fill:#fde8e8
```

## What is stored where

| Data | Store | Notes |
|---|---|---|
| Users, patients, records, notes | PostgreSQL | Medical data. Never on chain. |
| Access event (who/what/when) | PostgreSQL `access_logs` | The durable outbox row and the off-chain mirror |
| Rolling head hash, event count | Solana `AuditTrail` PDA | 82 bytes, one global trail |
| Solana `slot`, `signature`, `head_hash` per event | PostgreSQL `access_logs` | Filled in once anchored; makes the mirror auditable |

## Pseudonymisation

Patient and user ids are salted and hashed (`ACCESS_HASH_SALT`, 32-byte hex)
*before* they are encoded into the 83-byte on-chain event. The chain therefore
holds pseudonymous accountability — enough to prove an entry was not altered,
not enough to link an entry back to a named person from the chain alone.
