# Task: Solana Program Tests

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-11
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, rust, testing, required
- **Dependencies:** 24-solana-audit-program.md, 25-solana-devnet-deploy.md
- **Related:** 32-solana-e2e-and-disclosure.md
- **Estimated Effort:** 7h

## Requirements

- Every `AuditError` variant has a test that provokes it
- Hash computation is proven deterministic across client and program
- The pure module is covered by `cargo test` with no Solana tooling
- Integration tests exercise the real program via LiteSVM, without a validator process
- A test proves a dropped log entry is detectable

## User Stories

- As a builder, I want every error path covered so that I trust the authorization and concurrency logic
- As an auditor, I want a test proving tamper detection so that the headline claim is backed by evidence
- As a builder, I want fast tests so that I run them continuously under deadline

## Design

### Two test layers

**Unit (`cargo test`, no Solana):** pure `hash_chain` and `state` modules. Runs in under a second with only `cargo` installed. This is the safety net for the deadline.

**Integration (LiteSVM):** deploys the compiled `.so` into an in-process VM. No `solana-test-validator` Docker container, no port binding, no flakiness. `litesvm` + `anchor-litesvm` are the current tooling; `solana-program-test` is the older path and needs a validator.

Note: integration tests require `anchor build` output (`target/deploy/*.so`), so they only run once the Solana toolchain is available. This is exactly why the unit layer exists separately.

### Required cases

| Case | Asserts |
|---|---|
| Initialize creates the PDA | `head_hash == [0u8; 32]`, `event_count == 0` |
| First append | `head_hash == chain_head(zeros, e1)`, `event_count == 1` |
| Second append | chains from the previous head, not from zero |
| Determinism | same inputs, identical hash across independent calls |
| Unauthorized signer | non-authority gets `Unauthorized` |
| Stale prev_hash | wrong `prev_hash` gets `ChainBroken` |
| Concurrent writers | second writer rejected, first writer's head preserved |
| Event emission | `AccessLogged` carries the correct `seq` and `head_hash` |
| **Tamper detection** | removing an entry makes `verify_chain` fail against the known head |
| **Privacy boundary** | serialized `AccessEvent` contains no personal-data field |

The last two are the two that carry the project's claims, so they get explicit tests rather than incidental coverage.

### Tamper test

```rust
#[test]
fn dropped_entry_breaks_verification() {
    let events = vec![e(1), e(2), e(3)];
    let head = fold(&events);
    let mut tampered = events.clone();
    tampered.remove(1); // entry 2 silently dropped
    assert_ne!(head, fold(&tampered));
}
```

## Tasks

- [ ] Unit tests for `chain_head` determinism and sensitivity to each field
- [ ] Unit test: mutating any payload field changes the head
- [ ] Unit test: `verify_chain` accepts an intact log
- [ ] Unit test: `verify_chain` rejects a dropped entry
- [ ] LiteSVM setup: deploy program from bytes
- [ ] Test: initialize
- [ ] Test: happy-path append
- [ ] Test: unauthorized signer rejected
- [ ] Test: stale `prev_hash` rejected
- [ ] Test: two sequential writers, second chains correctly
- [ ] Test: two racing writers, exactly one rejected
- [ ] Test: privacy boundary (no personal data in payload)

## Done Criteria

- [ ] `cargo test` passes with no Solana CLI installed
- [ ] All three `AuditError` variants are provoked by a named test
- [ ] Concurrent-writer test asserts exactly one rejection
- [ ] Tamper test proves a dropped entry is detectable
- [ ] Privacy test asserts no personal-data field in the payload
- [ ] No test depends on network access or a running validator

## Notes

- A test that asserts nothing is worse than no test; each case above has a stated assertion
- LiteSVM tests need `include_bytes!` of the built `.so`, so they recompile when the program changes
- Keep `cargo test` (unit) in CI as the fast gate; run LiteSVM as a separate job

## Questions to Resolve

- [ ] Coverage threshold for the Rust program? The TS side uses 70%; mirror it?
- [ ] Should the tamper test live in Rust, TypeScript, or both? Both proves client and program agree