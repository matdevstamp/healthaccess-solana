# Task: Solana Client and High-Availability Demo

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-12
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, client, integration, required
- **Dependencies:** 28-remove-homemade-blockchain.md, 25-solana-devnet-deploy.md
- **Related:** 31-solana-ui-verification.md
- **Estimated Effort:** 5h

## Requirements

- A typed Solana client reads the program IDL and builds `record_access` instructions
- `SOLANA_*` environment variables are validated at startup
- `/api/health` reports Solana reachability, program presence, and current head
- The API exposes whether the local log matches the on-chain head
- The high-availability scenario is demonstrable end to end

## User Stories

- As a builder, I want a single typed client so that no route hand-rolls Solana calls
- As an operator, I want health to report chain state so that a broken deploy is visible
- As a patient, I want to know whether my access log is anchored so that I do not trust unverified data
- As a presenter, I want to kill a server and keep serving so that availability is a claim I can back

## Design

### Client module

```
src/lib/solana/
├── client.ts       # Connection from env, single instance
├── program.ts      # Program<HealthaccessAudit> from committed IDL
├── chain.ts        # fetchCurrentHead(), verifyAgainstChain()
└── events.ts       # AccessLogged decode, type mapping
```

One module owns all chain access. Routes import from it and never construct a `Connection` directly.

### Env

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=<from task 25>
SOLANA_KEYPAIR_PATH=~/.config/solana/devnet.json
SOLANA_CLUSTER=devnet
SOLANA_COMMITMENT=confirmed
```

Add to `src/lib/env.ts` via `requireEnv`, which already throws on missing values.

### Health

Extend the existing `/api/health`:

```json
{
  "status": "ok",
  "server": "hospital-s",
  "peer": { "healthy": true, "serverId": "ambulance-a" },
  "solana": {
    "reachable": true,
    "cluster": "devnet",
    "programId": "...",
    "programDeployed": true,
    "headHash": "4Fs9...",
    "pendingEvents": 0
  }
}
```

`pendingEvents > 0` is not an error; it means the flusher is behind. Surfacing it prevents the demo from looking broken when it is merely in flight.

### Verification endpoint

`GET /api/access-log` returns the Postgres rows plus:

```json
{
  "accessLogs": [ ... ],
  "verification": {
    "localHead": "…",
    "chainHead": "…",
    "match": true,
    "checkedAt": "…"
  }
}
```

`match: false` means the local mirror diverged from chain state, which is exactly the tamper signal the project claims.

### The HA demo

This is the replacement for the old chain-replication demo, and it is stronger:

1. Both servers running, notes syncing live
2. Doctor views a patient record on server 1
3. Access log anchors on-chain; Solscan link opens
4. **Kill server 1**
5. Server 2 keeps serving; the audit trail is fully intact because it lives on-chain, not in a process

The old architecture could not do step 5 without data loss. That contrast is the strongest slide in the deck.

## Tasks

- [ ] Add `SOLANA_*` to `env.ts` and `.env.example`
- [ ] Implement `client.ts` and `program.ts` from the committed IDL
- [ ] Implement `fetchCurrentHead()`
- [ ] Implement `verifyAgainstChain()`
- [ ] Map `AccessLogged` to the UI-facing `AccessLogPreview` type
- [ ] Extend `/api/health` with the solana block
- [ ] Extend `GET /api/access-log` with the verification block
- [ ] Unit tests for head comparison, including mismatch
- [ ] Manual HA walkthrough: kill server 1, verify server 2 serves and logs persist

## Done Criteria

- [ ] No route constructs a `Connection` directly
- [ ] Missing `SOLANA_*` env fails fast with a clear message
- [ ] `/api/health` reports chain reachability and pending count
- [ ] `GET /api/access-log` reports `match` between local and chain heads
- [ ] A deliberately altered local log produces `match: false`
- [ ] Killing one server leaves the other serving with an intact audit trail
- [ ] Unit tests green

## Notes

- `confirmed` commitment is enough for a demo; `finalized` adds latency for little benefit
- Devnet public RPC will rate-limit under E2E parallelism; use a keyed provider for tests
- The verification endpoint is cheap (one `getAccountInfo`) and makes the tamper claim checkable by anyone

## Questions to Resolve

- [ ] Cache the head hash, or read it per request? Reading per request is simpler and current enough
- [ ] Should the health endpoint fail loudly when the program is missing, or degrade with `status: degraded`?