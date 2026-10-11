# Task: Wire Flusher to the Solana Program

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-12
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, integration, required
- **Dependencies:** 31-remove-homemade-blockchain.md, 30-solana-client-and-env.md
- **Related:** 33-patient-wallet.md
- **Estimated Effort:** 5h

## Requirements

- The flusher uses the real Solana client instead of the mock
- The flusher starts on both server instances
- Two servers flushing concurrently do not submit the same row twice
- The high-availability scenario is demonstrable end to end

## User Stories

- As a patient, I want my access event anchored so that I can verify it independently
- As a presenter, I want to kill a server and keep serving so that availability is a claim I can back
- As the system, I want both servers able to write so that neither is a single point of failure

## Design

### The swap

Task 26 built the flusher against the `ChainSubmitter` interface. This task
replaces the mock:

```ts
// before (task 26)
const submitter = mockSubmitter;

// after (this task)
const submitter = solanaSubmitter;  // task 30
```

One line plus the startup wiring. That narrow interface is what allowed task 26
to be built and tested before the program existed.

### Startup

The flusher starts from `instrumentation-node.ts`, alongside the existing
Socket.IO server and peer heartbeat:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
```

Both instances run a flusher, because both instances write access events.

### Duplicate-submission guard

Two servers flushing the same pending row would anchor it twice and fork the
chain's event count. Guard at the database:

```sql
UPDATE access_log
SET status = 'flushing', attempt = attempt + 1
WHERE id = $1 AND status = 'pending'
RETURNING id
```

Zero rows returned means another instance claimed it. Alternatively
`SELECT ... FOR UPDATE SKIP LOCKED`.

### The high-availability demo

This replaces the old chain-replication demo and is stronger:

1. Both servers running, notes syncing live
2. Doctor views a patient record on server 1
3. Access log anchors on-chain; Solscan link opens
4. **Kill server 1**
5. Server 2 keeps serving; the audit trail is fully intact because it lives on-chain, not in a process

The old architecture could not do step 5 without data loss. That contrast is the
strongest slide in the deck.

## Tasks

- [ ] Replace the mock submitter with the real client
- [ ] Start the flusher from `instrumentation-node.ts`
- [ ] Add the claim guard to prevent duplicate submission
- [ ] Verify both instances flush independently
- [ ] Verify a claimed row is skipped by the other instance
- [ ] Manual HA walkthrough: kill server 1, verify server 2 serves and logs persist
- [ ] Confirm `pendingEvents` returns to zero under steady state

## Done Criteria

- [ ] Access events reach the chain end to end from a record view
- [ ] The flusher runs on both server instances
- [ ] No event is submitted twice under concurrent flushing
- [ ] Killing one server leaves the other serving with an intact audit trail
- [ ] `pendingEvents` drains to zero
- [ ] Flusher failures never surface in a user request

## Notes

- Measure real devnet latency; it informs the "off the hot path" claim in the pitch
- If the flusher cannot keep up during the demo, showing a draining count is honest and reinforces the outbox design
- Do not let a flusher error propagate into the request path

## Questions to Resolve

- [ ] Flush immediately on write plus a periodic sweep, or on a fixed interval?
- [ ] What is acceptable pending lag before the demo looks wrong?