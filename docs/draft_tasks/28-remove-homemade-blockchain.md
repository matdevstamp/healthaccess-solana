# Task: Remove the Homemade Blockchain

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-12
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, refactor, cleanup, required
- **Dependencies:** 27-outbox-and-solana-flusher.md
- **Related:** 29-solana-client-and-ha-demo.md
- **Estimated Effort:** 6h

## Requirements

- All homemade blockchain code is deleted, not deprecated
- Chain-replication P2P is deleted; note and health P2P are kept
- Both server instances continue to run and stay in sync for notes
- The two-server architecture survives (it is the high-availability story)
- All call sites are updated and the suite is green

## User Stories

- As a builder, I want the old chain gone so that there is exactly one audit implementation
- As a presenter, I want two servers still running so that I can demo high availability
- As a presenter, I want realtime note sync intact so that the multi-node story still lands

## Design

### Surgical split of the P2P layer

The P2P layer carries two unrelated concerns. This task removes one and keeps the other.

| File | Function | Fate |
|---|---|---|
| `src/lib/p2p/transport.ts:7` | `sendAccessLogToPeer` | **delete** (chain replication) |
| `src/lib/p2p/transport.ts:102` | `fetchAccessLogsFromPeer` | **delete** (reads `chainValid`) |
| `src/lib/p2p/transport.ts:36` | `sendNoteToPeer` | **keep** (realtime notes) |
| `src/lib/p2p/transport.ts:73` | `fetchPeerHealth` | **keep** (HA) |
| `src/lib/p2p/peer-auth.ts` | shared-secret auth | **keep** |
| `src/lib/p2p/peer-health.ts` | heartbeat | **keep** |
| `src/lib/p2p/peer.ts` | `Peer` class | **delete** (imports `Blockchain`) |
| `src/app/api/p2p/access-log/` | chain replication route | **delete** |
| `src/app/api/p2p/note/` | note relay | **keep** |
| `src/app/api/p2p/server-peer.ts` | `syncServerPeer` | **delete** |

`peer.ts:1` imports `Blockchain` directly, so the whole class goes. `Peer.receiveMessage` also enforces the anti-forgery rule `message.from === message.data.serverId`, which only existed for chain messages.

### Blockchain files

```
src/lib/blockchain/block.ts               delete
src/lib/blockchain/blockchain.ts          delete
src/lib/blockchain/access-log.ts          delete (replaced by on-chain AccessEvent)
src/lib/blockchain/access-log-service.ts  delete (replaced by the outbox write)
```

### Six async call sites

`createAccessLog` was synchronous and returned a `Block`. Solana submission is async and returns a signature. Each site becomes an await plus an outbox insert.

| File | Lines | Actions |
|---|---|---|
| `src/app/api/patients/[id]/route.ts` | 25, 40, 53 | `view_denied`, `view_not_found`, `view` |
| `src/app/api/notes/route.ts` | 47, 70, 134 | `view_denied`, `view`, `create` |
| `src/app/api/notes/[id]/route.ts` | 82, 130 | `edit`, `delete` |
| `src/lib/notes/log.ts` | 12 | wrapper |

Note the denial paths (`view_denied`, `view_not_found`) are the GDPR-important ones: refused access must be logged too, arguably more so.

### Tests to delete or rewrite

- `src/lib/blockchain/blockchain.test.ts` (162 lines) — **delete**, tests removed code
- `src/lib/blockchain/access-log-service.test.ts` — **delete**
- `src/lib/p2p/peer.test.ts` — **delete**
- `src/lib/p2p/transport.test.ts` — **rewrite**, keep note + health, drop access-log
- `src/app/api/p2p/p2p-routes.test.ts` — **rewrite**
- `src/app/api/access-log/route.test.ts` — **rewrite** for the new source
- `e2e/blockchain/access-logging.spec.ts` — **rewrite**, PRESERVE the privacy-boundary assertions at lines 56-76
- `e2e/blockchain/p2p.spec.ts` (465 lines) — **rewrite**, chain convergence no longer applies; note sync remains
- `e2e/blockchain/verify.spec.ts` — **rewrite**, badge strings change
- `vitest.config.ts:26-35` — update coverage exclusions

The privacy test is the one assertion in the repo that must survive verbatim in spirit: no medical content, no note body, no personal number reaches the chain payload.

### What improves

- **Durability.** The chain was in-memory per process and vanished on restart. Now it is on-chain and permanent.
- **Authenticity.** `Block.hash` was recomputable by anyone holding the data, so `isValid()` proved internal consistency, not authenticity. Now writes are signed by the program authority.
- **Cost.** `addAccessLog` re-sorted and rebuilt the entire chain per insert. Now appends are O(1).
- **Availability.** One server dying previously lost half the audit trail. Now the log is external to both processes.

## Tasks

- [ ] Delete `src/lib/blockchain/` entirely
- [ ] Delete `peer.ts`, `server-peer.ts`, `/api/p2p/access-log`
- [ ] Remove the two dead transport functions
- [ ] Rewrite the 6 call sites to await the outbox write
- [ ] Rewrite `GET /api/access-log` to read from Postgres
- [ ] Delete or rewrite the affected unit tests
- [ ] Rewrite the affected E2E specs
- [ ] Preserve the privacy-boundary assertions
- [ ] Update `vitest.config.ts` exclusions
- [ ] Verify both servers boot and note sync still works
- [ ] `npm run lint && npm run typecheck && npm run test` green

## Done Criteria

- [ ] No file under `src/lib/blockchain/` remains
- [ ] No reference to `Blockchain`, `Block`, `createAccessLog`, or `chainValid` in `src/`
- [ ] No reference to `syncServerPeer` or `/api/p2p/access-log`
- [ ] Note sync between servers still works
- [ ] Peer health checks still pass
- [ ] Both servers start and serve
- [ ] Full test suite green
- [ ] Privacy-boundary test still asserts no medical content on-chain

## Notes

- Delete rather than comment out. Dead blockchain code in a public hackathon repo is an invitation to questions you do not want
- `GET /api/access-log` returns `chainValid` today; replace with the on-chain head comparison from task 29
- `docs/diagrams/data-flow.md` and `demo/captions.ts:70` claim blocks are signed; the code change makes that true, and task 32 updates the docs
- Two e2e specs reference stale mock headers (`x-mock-role`) that the API does not accept; do not carry that forward

## Questions to Resolve

- [ ] Keep the two-server demo, or drop to a single server and reclaim the time? Recommendation: keep, it is the HA story
- [ ] Should `AccessLog` rows still exist for pending events, or only anchored ones?