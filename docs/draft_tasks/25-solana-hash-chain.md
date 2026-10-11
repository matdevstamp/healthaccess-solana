# Task: Pure Hash Chain Module

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-11
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, rust, blockchain, parallel-safe, required
- **Dependencies:** 23-freeze-interface-contract.md
- **Related:** 27-build-anchor-program.md
- **Estimated Effort:** 5h

## Requirements

- `hash_chain.rs` and `state.rs` contain no `anchor_lang` import
- `cargo test` runs with zero Solana tooling installed
- The hash is `sha256(prev_hash || canonical_borsch(event))`
- Client-side and program-side byte encodings are provably identical
- `verify_chain` detects a dropped entry

## User Stories

- As a builder, I want the hash logic in a plain Rust module so that I can test it before the Solana toolchain is ready
- As an auditor, I want a dropped entry to be detectable so that the immutability claim is real
- As a builder, I want fast tests so that I run them continuously under deadline

## Design

### This is the half that makes parallelism safe

The original task 24 was 12h of one indivisible unit sitting on the critical
path. Split into this (pure, verifiable immediately) and task 27 (Anchor glue).
Each is roughly half, and they run concurrently because the seam between them
is written down in `INTERFACE-CONTRACT.md` before either starts.

The payoff is scheduling, not elegance: if this task is green, the hardest logic
is proven regardless of whether the Solana toolchain cooperates.

### Pure means pure

```
programs/healthaccess_audit/src/
├── hash_chain.rs   # this task
├── state.rs        # this task
└── errors.rs       # this task
```

No `anchor_lang`, no `solana_program`, no generated IDL types. Standard
`sha2` and `borsh` are fine. If a file here imports `anchor_lang`, it has
defeated the purpose of the split.

### The hash

```
head = sha256( prev_hash || canonical_borsh(event) )
```

Canonical Borsh, not JSON and not string concatenation, because both drift:
field order, unicode escaping, and integer width all change the bytes without
changing the logical value. A client and a program that disagree on encoding
produce a log that verifies as tampered even though nothing was tampered with.

`prev_hash` for the first event is `[0u8; 32]`.

### Public surface

The seam task 27 wraps. Signatures are fixed by the contract.

```rust
pub fn chain_head(prev: &[u8; 32], event: &AccessEvent) -> [u8; 32];
pub fn verify_chain(events: &[AccessEvent], expected: &[u8; 32]) -> bool;
```

### Tamper detection

The property that carries the project's headline claim:

```rust
#[test]
fn dropped_entry_breaks_verification() {
    let events = vec![e(1), e(2), e(3)];
    let head = fold(&events);
    let mut tampered = events.clone();
    tampered.remove(1);
    assert_ne!(head, fold(&tampered));
}
```

Solana transactions are individually immutable, but there is no ordering
guarantee across accounts and no way to prove a log entry was *never omitted*.
The rolling head closes that gap.

## Tasks

- [ ] Implement `AccessEvent::canonical_bytes()` returning 83 bytes
- [ ] Implement `chain_head()`
- [ ] Implement `verify_chain()`
- [ ] Define the `AuditError` variants
- [ ] Unit test: determinism, same inputs give the same head
- [ ] Unit test: mutating any field changes the head
- [ ] Unit test: `verify_chain` accepts an intact log
- [ ] Unit test: dropped entry breaks verification
- [ ] Unit test: canonical bytes are exactly 83 bytes
- [ ] Unit test: canonical encoding is field-order independent of construction order

## Done Criteria

- [ ] `cargo test` passes with `solana` and `anchor` NOT on PATH
- [ ] No `anchor_lang` import in the three pure files
- [ ] `canonical_bytes()` returns exactly 83 bytes
- [ ] `chain_head` matches the contract formula
- [ ] `verify_chain` rejects a dropped entry
- [ ] Every `AuditError` variant is referenced in a test
- [ ] Tests run in under a second

## Notes

- **Owner of these three files exclusively.** Task 27 wraps them; it does not edit them
- If a test fails because of an encoding choice, fix the encoding, not the test
- Keep `version: u8` in the account plan for the same reason: migrating account layout later means a redeploy
- A test that asserts nothing is worse than no test

## Questions to Resolve

- [ ] Should `chain_head` use SHA-256 directly or a domain-separated variant? Direct SHA-256 matches the contract and keeps client and program identical
- [ ] Should `verify_chain` live here or in a later task? Contract puts it here