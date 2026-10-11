# Task: Solana Program Tests

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-11
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, rust, testing, required
- **Dependencies:** 27-build-anchor-program.md, 28-solana-devnet-deploy.md
- **Related:** 35-solana-e2e-and-disclosure.md
- **Estimated Effort:** 7h

## Requirements

- Every `AuditError` variant has a test that provokes it
- Hash computation is provably deterministic
- Integration tests exercise the real program without a validator process
- A test proves a dropped log entry is detectable
- A test proves no personal data reaches the payload

## User Stories

- As a builder, I want every error path covered so that I trust the authorization and concurrency logic
- As an auditor, I want a test proving tamper detection so that the headline claim is backed by evidence
- As a builder, I want fast tests so that I run them continuously under deadline

## Design

### Two layers

**Unit (`cargo test`, no Solana):** the pure modules from task 25. Runs in under
a second with only `cargo`. This is the safety net for the deadline.

**Integration (LiteSVM):** deploys the compiled `.so` into an in-process VM.
No `solana-test-validator` Docker container, no port binding, no flakiness.
`solana-program-test` is the older path and needs a validator.

Integration tests need `anchor build` output, so they only run once the Solana
toolchain is available. That is exactly why the unit layer exists separately.

### Required cases

| Case | Asserts |
|---|---|
| Initialize | `head_hash == [0u8; 32]`, `event_count == 0` |
| First append | `head_hash == chain_head(zeros, e1)` |
| Second append | chains from the previous head, not from zero |
| Determinism | identical inputs give an identical head across calls |
| Unauthorized signer | non-authority gets `Unauthorized` |
| Stale prev_hash | wrong `prev_hash` gets `ChainBroken` |
| Concurrent writers | second rejected, first writer's head preserved |
| Event emission | `AccessLogged` carries correct `seq` and `head_hash` |
| **Tamper detection** | removing an entry breaks `verify_chain` |
| **Privacy boundary** | serialized payload has no personal-data field |

The last two carry the project's headline claims, so they get explicit tests
rather than incidental coverage.

### Tamper test

```rust
#[test]
fn dropped_entry_breaks_verification() {
    let events = vec![e(1), e(2), e(3)];
    let head = fold(&events);
    let mut tampered = events.clone();
    tampered.remove(1);                       // entry 2 silently dropped
    assert_ne!(head, fold(&tampered));
}
```

### Anchor 1.2 testing API

Anchor 1.x offers `anchor_litesvm` / `AnchorLiteSVM`, with `declare_program!`
generating types from the IDL at compile time. Verify the exact API against
installed docs before writing; the 0.x `ProgramTest` patterns have changed.

## Tasks

- [ ] Unit tests for `chain_head` determinism and field sensitivity
- [ ] Unit test: mutating any payload field changes the head
- [ ] Unit test: `verify_chain` accepts an intact log
- [ ] Unit test: dropped entry breaks verification
- [ ] LiteSVM setup: deploy program from bytes
- [ ] Test: initialize
- [ ] Test: happy-path append
- [ ] Test: unauthorized signer rejected
- [ ] Test: stale `prev_hash` rejected
- [ ] Test: two sequential writers chain correctly
- [ ] Test: two racing writers, exactly one rejected
- [ ] Test: event emission with correct seq and head
- [ ] Test: privacy boundary

## Done Criteria

- [ ] `cargo test` passes with no Solana CLI on PATH
- [ ] All three `AuditError` variants provoked by a named test
- [ ] Concurrent-writer test asserts exactly one rejection
- [ ] Tamper test proves a dropped entry is detectable
- [ ] Privacy test asserts no personal-data field
- [ ] No test depends on network access or a running validator

## Notes

- A test that asserts nothing is worse than no test; every case above has a stated assertion
- LiteSVM tests use `include_bytes!` of the built `.so`, so they recompile when the program changes
- Keep `cargo test` (unit) as the fast CI gate; LiteSVM as a separate job

## Questions to Resolve

- [ ] Coverage threshold for the Rust program? The TS side uses 70%; mirror it?
- [ ] Should the tamper test live in Rust, TypeScript, or both? Both proves client and program agree