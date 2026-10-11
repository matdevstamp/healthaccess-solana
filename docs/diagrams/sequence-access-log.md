# Sequence: Permitted Read → Outbox → On-chain Anchor

An authorized user opens a record on server 1. Medical data is fetched from
PostgreSQL and stays in SQL. The access is written to the durable outbox, then
a background flusher commits it to the Solana program. Once anchored, the
off-chain mirror carries the `slot`, `signature`, and `head_hash`, which
`/api/access-log` can compare against chain state.

```mermaid
sequenceDiagram
    autonumber
    participant U as Staff (browser)
    participant S as Next.js server
    participant DB as PostgreSQL
    participant F as Outbox flusher
    participant CH as Solana program
    participant T as AuditTrail PDA

    U->>S: POST /api/auth/login
    S-->>U: JWT in httpOnly cookie

    U->>S: GET /api/patients/:id (with cookie)
    S->>S: verify role + visibility
    S->>DB: read journal (SQL)
    DB-->>S: medical data — stays in SQL
    S->>DB: INSERT access_log (status = pending)
    S-->>U: journal + permitted notes

    Note over S: the read is already logged, even if the chain is unreachable

    loop until anchored or attempts exhausted
        F->>CH: read current head
        CH-->>F: head_hash
        F->>CH: record_access(event, prev_hash = head)
        alt prev_hash matches head
            CH->>T: head = sha256(prev ‖ borsh(event))
            CH-->>F: signature, slot, AccessLogged
            F->>DB: status = anchored, store slot + signature + head_hash
        else another writer won the race
            CH-->>F: ChainBroken
            Note over F: re-read head and retry
        end
    end

    U->>S: GET /api/access-log
    S->>DB: read mirror
    S->>CH: read current head
    S-->>U: entries + verification (mirror head == chain head?)
```

## Why the retry loop matters

Two servers write to one global `AuditTrail`. `record_access` is optimistic
concurrency: the transaction fails with `ChainBroken` if `prev_hash` is not the
current head. The flusher therefore re-reads the head on **every** attempt — a
blind retry with a stale `prev_hash` would fail identically forever.
