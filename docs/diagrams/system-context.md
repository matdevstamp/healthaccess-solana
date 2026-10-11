# System Context

HealthAccess runs as **two fullstack Next.js servers** (e.g. hospital-s and
ambulance-a) that share one PostgreSQL database for medical data. Each access
to a record is committed to a **Solana program** that keeps a single rolling
hash of the access log; no medical data ever reaches the chain.

```mermaid
flowchart TD
    DOC["Doctor / Nurse / Ambulance staff"]
    VC["Primary care staff"]
    PAT["Patient"]
    UNAUTH["Unauthorized user"]

    subgraph S1["Next.js server 1 — hospital-s (:3001)"]
        API1["Route handlers + auth<br/>(JWT in httpOnly cookie)"]
        OB1["Durable outbox + flusher"]
    end

    subgraph S2["Next.js server 2 — ambulance-a (:3002)"]
        API2["Route handlers + auth<br/>(JWT in httpOnly cookie)"]
        OB2["Durable outbox + flusher"]
    end

    DB[("PostgreSQL — shared DB:<br/>users, patients, records,<br/>notes, access_logs (outbox + mirror)")]
    PROG["Solana program<br/>healthaccess_audit"]
    TRAIL[("AuditTrail PDA<br/>rolling head_hash")]

    DOC -->|login, search, journal, notes| API1
    DOC -->|login, live notes| API2
    VC -->|login, shared clinical access| API1
    PAT -->|login, own journal + access log| API1
    UNAUTH -->|any URL| API1

    API1 <-->|"SQL: medical data — never on chain"| DB
    API2 <-->|"SQL: medical data"| DB

    API1 -->|enqueue access event| OB1
    OB1 -->|"record_access (re-read head, submit)"| PROG
    API2 -->|enqueue access event| OB2
    OB2 --> PROG
    PROG --> TRAIL

    API1 <-->|"note sync + heartbeat (HTTP + Socket.IO)"| API2

    style DB fill:#e8f0fe
    style PROG fill:#fde8e8
    style TRAIL fill:#fde8e8
```

## Actors

| Actor | Can | Cannot |
|---|---|---|
| Doctor / nurse / ambulance | Search patients, read journals, write notes per visibility | Read without leaving an access event |
| Primary care | The same clinical access as other staff | — |
| Patient | Read their own record and its access log | Read any other patient; edit notes |
| Unauthorized | Log in and hit protected routes | Reach protected resources (denied, and the denial is logged) |

The chain is deliberately **not** an authorization layer. Roles and access are
checked in the Next.js layer; the program only guarantees the log is
append-only.
