# Task: Solana Client and Environment

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-12
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, client, integration, required
- **Dependencies:** 27-build-anchor-program.md, 28-solana-devnet-deploy.md
- **Related:** 32-wire-flusher-to-program.md
- **Estimated Effort:** 5h

## Requirements

- A typed Solana client reads the committed IDL and builds `record_access`
- `SOLANA_*` env variables are validated at startup
- The client implements the `ChainSubmitter` interface from task 26
- `/api/health` reports Solana reachability, program presence, and current head
- `GET /api/access-log` exposes whether the local log matches the on-chain head
- Patient and user IDs are salted-hashed before leaving the server

## User Stories

- As a builder, I want a single typed client so that no route hand-rolls Solana calls
- As an operator, I want health to report chain state so that a broken deploy is visible
- As a patient, I want to know whether my access log is anchored so that I do not trust unverified data

## Design

### Client module

```
src/lib/solana/
├── client.ts     # Connection from env, single instance
├── program.ts    # Program<HealthaccessAudit> from the committed IDL
├── submitter.ts  # implements ChainSubmitter for task 26
├── chain.ts      # fetchCurrentHead(), verifyAgainstChain()
└── events.ts     # AccessLogged decode, type mapping
```

One module owns all chain access. Routes import from it and never construct a
`Connection` directly.

### Implementing ChainSubmitter

This is the seam that lets task 26 build and test in parallel:

```ts
export const solanaSubmitter: ChainSubmitter = {
  async fetchHead() { /* read AuditTrail PDA */ },
  async submit(event, prevHash) { /* record_access, return signature */ },
};
```

Task 26's flusher depends on this interface, never on `@solana/web3.js`
directly.

### Hashing before the chain

`ACCESS_HASH_SALT` (32-byte hex) salts patient and user IDs into
`patient_hash` / `actor_hash`. The chain therefore holds pseudonymous
accountability, not linkable identity. This is the GDPR boundary, enforced in
code rather than by convention.

```ts
function saltedHash(id: number): Uint8Array {
  return sha256(concat(env.accessHashSalt, leBytes(id)));
}
```

### Env

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=
SOLANA_KEYPAIR_PATH=~/.config/solana/devnet.json
SOLANA_CLUSTER=devnet
SOLANA_COMMITMENT=confirmed
ACCESS_HASH_SALT=
```

Declared in `src/lib/env.ts` via `requireEnv`, which already throws on missing
values. `ACCESS_HASH_SALT` must never be committed.

### Health

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

`pendingEvents > 0` is not an error. It means the flusher is behind, and
surfacing it stops the demo looking broken when it is merely in flight.

### Verification

`GET /api/access-log` returns rows plus:

```json
{
  "accessLogs": [],
  "verification": {
    "localHead": "...",
    "chainHead": "...",
    "match": true,
    "checkedAt": "..."
  }
}
```

`match: false` means the local mirror diverged from chain state, which is the
tamper signal the project claims.

## Tasks

- [ ] Add `@solana/web3.js` and `@coral-xyz/anchor`
- [ ] Add `SOLANA_*` and `ACCESS_HASH_SALT` to `env.ts` and `.env.example`
- [ ] Implement `client.ts` and `program.ts` from the committed IDL
- [ ] Implement salted hashing for patient and user IDs
- [ ] Implement `submitter.ts` against `ChainSubmitter`
- [ ] Implement `fetchCurrentHead()`
- [ ] Implement `verifyAgainstChain()`
- [ ] Map `AccessLogged` to `AccessLogPreview`
- [ ] Extend `/api/health` with the solana block
- [ ] Extend `GET /api/access-log` with the verification block
- [ ] Unit tests for head comparison, including mismatch

## Done Criteria

- [ ] No route constructs a `Connection` directly
- [ ] Missing `SOLANA_*` env fails fast with a clear message
- [ ] `/api/health` reports chain reachability and pending count
- [ ] `GET /api/access-log` reports `match` between local and chain heads
- [ ] A deliberately altered local log produces `match: false`
- [ ] Patient and user IDs are hashed before leaving the server
- [ ] `ChainSubmitter` is implemented and unit tests green

## Notes

- **Owns `package.json` and `src/lib/env.ts` exclusively.** Task 33 rebases onto this
- `slot` and `recordId` are `bigint`; they exceed `Number.MAX_SAFE_INTEGER`. Getting this wrong silently corrupts values
- `confirmed` commitment is enough for a demo; `finalized` adds latency for little benefit
- The public devnet RPC will rate-limit under parallel E2E; use a keyed provider for tests

## Questions to Resolve

- [ ] Cache the head hash or read per request? Per request is simpler and current enough
- [ ] Should health fail loudly when the program is missing, or degrade to `status: degraded`?