# Task: Solana Verification UI

## Metadata
- **Priority:** P1 - Cut line
- **Deadline:** 2026-10-12
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, frontend, ui, cutline
- **Dependencies:** 32-wire-flusher-to-program.md
- **Related:** 33-patient-wallet.md
- **Estimated Effort:** 6h

## Requirements

- Each access-log row shows its transaction signature and slot
- Signatures link to the devnet explorer
- The badge reflects real verification, not a hardcoded string
- Pending events are visibly distinct from anchored ones
- Patients can see the chain verification state for their own records

## User Stories

- As a patient, I want to click through to the blockchain so that I can verify independently rather than trust the app
- As a patient, I want to tell anchored entries from pending ones so that I do not mistake a queue for a record
- As a presenter, I want the badge to be honest so that a judge who checks it is not let down

## Design

### Replacing a fake badge

`patient-journal.tsx:358` currently renders one of two hardcoded strings,
`"Blockchain verified"` or `"Blockchain verification failed"`, driven by an
in-process `chainValid` boolean. That check proved internal consistency of a
hash chain anyone could recompute. The new badge must reflect a real on-chain
comparison from task 30.

```tsx
<AccessLogRow
  entry={row}
  signature={row.signature}
  slot={row.slot}
  verified={verification.match}   // real chain comparison
/>
```

### Three states, not two

| State | Condition | Display |
|---|---|---|
| Anchored | `signature` present and head matches | green badge, Solscan link, slot |
| Pending | `status === "pending"` | amber badge, "awaiting anchor" |
| Diverged | `match === false` | red badge, "log does not match chain" |

The old two-state boolean cannot express pending. Showing amber when the
flusher is mid-flight is honest and reinforces the outbox design.

### Explorer links

```ts
const explorer = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${env.solanaCluster}`;
```

The cluster must come from config. A hardcoded cluster silently opens a mainnet
account that does not exist.

### Patient-facing chain panel

Above the log:

- Current on-chain head
- Local head
- Entry count, anchored count, pending count
- Verification state with a timestamp

This is what a judge reads from across the room. It makes the abstract claim
concrete.

### Accessibility

The badge must not be color-only. Include text, and mark it `role="status"` so
a screen reader announces the change when the flusher anchors an entry.

## Tasks

- [ ] Add signature, slot, and status to the access-log row
- [ ] Add Solscan links per row
- [ ] Replace hardcoded badge strings with real state
- [ ] Implement the three-state badge
- [ ] Add the chain panel to the patient journal
- [ ] Show anchored vs pending counts
- [ ] Ensure the badge is not color-only and is announced politely
- [ ] Handle a failed verification state without breaking the page
- [ ] Verify links resolve on devnet

## Done Criteria

- [ ] Every anchored row shows a working Solscan link
- [ ] Badge text reflects real chain state, not a constant
- [ ] Pending entries are visually and textually distinct
- [ ] Diverged state is reachable and correctly displayed
- [ ] The patient journal shows head hash and counts
- [ ] Badge is accessible without color perception
- [ ] Explorer cluster matches the configured cluster

## Notes

- **CUT LINE.** If behind after task 32, ship only the signature link and drop the rest
- Keep `data-testid="access-log-row"` (`patient-journal.tsx:338`) intact; E2E specs depend on it
- Rehearse so the amber pending state does not read as a failure
- `AccessLogPreview.verified` in `src/lib/types/api.ts:144-159` is replaced by the richer status enum

## Questions to Resolve

- [ ] Should the chain panel be visible to staff too, or patients only?
- [ ] Poll for pending entries or rely on the socket? Socket is smoother if the flusher emits