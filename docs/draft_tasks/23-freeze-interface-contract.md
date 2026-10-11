# Task: Freeze the Interface Contract

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-10
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, contract, parallel-enabler, required
- **Dependencies:** None
- **Related:** 24-solana-program-scaffold.md, 25-solana-hash-chain.md
- **Estimated Effort:** 3h

## Requirements

- `docs/hackathon/INTERFACE-CONTRACT.md` exists, is committed, and is frozen
- Every type crossing an agent boundary is specified byte-exactly
- Every file has exactly one owner
- `docs/hackathon/PARALLEL-EXECUTION.md` exists with waves and merge order

## User Stories

- As a builder, I want interfaces frozen before parallel work so that agents can build against a spec instead of each other
- As a builder, I want one owner per file so that parallel agents do not collide
- As a builder, I want the contract committed so that a contract change is a reviewable diff

## Design

This task produces no runtime code. It produces the thing that makes every other
task parallelizable.

### Why this exists

The plan is ~50h of work against a fixed deadline with agents working
concurrently. Agents running against a prose description of an interface will
produce mutually incompatible code that type-checks separately and fails at
integration. Writing the bytes down first is cheaper than reconciling later.

### What must be specified

1. The `AuditTrail` account layout, with total byte size computed
2. The `AccessEvent` payload, with size and the no-`String`/no-`Vec` rule
3. Numeric enums for action and role
4. The hash function: `sha256(prev_hash || canonical_borsh(event))`
5. Pure Rust module boundaries, so `cargo test` runs without Solana
6. The public function signatures the Anchor layer wraps
7. Instruction order of operations, including the concurrency check
8. TypeScript types, with `bigint` where numbers overflow
9. Environment variable names
10. File ownership table, including the `package.json` serialization point

### Verification

- Every filename referenced in the ownership table exists or is marked for creation
- Every type named in section 6 matches what task 30 will implement
- `cargo test` compiles against the pure module signatures described

## Tasks

- [ ] Write the account layout with computed byte size
- [ ] Write the payload with computed byte size and encoding rules
- [ ] Define numeric enums for action and role
- [ ] Specify the hash function and why it is not JSON
- [ ] Define pure module boundaries and public signatures
- [ ] Specify instruction order of operations
- [ ] Define TypeScript types with `bigint` where required
- [ ] List environment variables
- [ ] Build the file ownership table
- [ ] Write `PARALLEL-EXECUTION.md` with waves and merge order
- [ ] Get the contract reviewed and committed
- [ ] Announce the contract is frozen

## Done Criteria

- [ ] `docs/hackathon/INTERFACE-CONTRACT.md` exists and is committed
- [ ] `docs/hackathon/PARALLEL-EXECUTION.md` exists and is committed
- [ ] Byte sizes for `AuditTrail` and `AccessEvent` are stated and correct
- [ ] Every type crossing a task boundary is specified
- [ ] Every file in the ownership table has exactly one owner
- [ ] The `package.json` serialization point is called out
- [ ] Both documents are committed before tasks 24, 25, and 26 start

## Notes

- **Start this first.** It is the single highest-leverage task, because everything else blocks on it
- Do not start implementation against a contract that is still in draft. Draft it, review it, freeze it, commit it
- If the contract is wrong, change it here and re-announce. Do not drift it per-branch, that is the failure mode this task exists to prevent
- Anchor is 1.2.1. Verify the macro layout against real examples rather than assuming 0.x idioms

## Questions to Resolve

- [ ] Does Anchor 1.2 use `declare_program!` or classic `declare_id!`? Confirm against installed docs before task 24 writes the scaffold
- [ ] Is the event emission API still `emit!(AccessLogged {...})` in 1.x?