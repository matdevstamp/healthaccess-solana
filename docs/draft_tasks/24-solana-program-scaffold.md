# Task: Solana Program Scaffold

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-11
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, rust, anchor, scaffold, parallel-safe
- **Dependencies:** 23-freeze-interface-contract.md
- **Related:** 27-build-anchor-program.md
- **Estimated Effort:** 4h

## Requirements

- An Anchor project `healthaccess_audit` exists with the contract's layout
- `Anchor.toml` targets devnet
- The IDL generates successfully
- Account contexts are declared with correct seeds and constraints
- No instruction logic is written

## User Stories

- As a builder, I want the workspace structured so that task 27 can start immediately
- As a builder, I want this to run in parallel with the hash chain so that the critical path shortens
- As a reviewer, I want the scaffolding verified against Anchor 1.2 so that task 27 does not start from broken templates

## Design

Structural only. Done-criteria are shape, never behavior. Task 27 adds logic.

### Anchor 1.2.1 — verify before writing

The toolchain is Anchor 1.2.1, and 1.x introduced `declare_program!` and changed
idioms relative to 0.x. **Confirm the macro layout against installed examples
before writing.** A scaffold built from 0.x memory will cost more to fix than to
write.

```bash
anchor --version
# read the generated 0.31 -> 1.0 migration notes, or scaffold a hello-world
# in /tmp and read what it produces
```

### Account

```rust
#[account]
#[derive(InitSpace)]
pub struct AuditTrail {
    pub version: u8,
    pub authority: Pubkey,
    pub head_hash: [u8; 32],
    pub event_count: u64,
    pub bump: u8,
}
```

Single global PDA, seeds `[b"audit_trail"]`. Per-organization trails were
considered and deferred: they multiply account count and contention analysis for
no demo gain, and it is a good question to raise at the Build Station rather
than build two days before a deadline.

### Payload

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AccessEvent {
    pub patient_hash: [u8; 32],
    pub actor_hash: [u8; 32],
    pub action: u8,
    pub role: u8,
    pub record_id: i64,
    pub server: u8,
    pub timestamp: i64,
}
```

Constraints, all from the contract:

- No `String`, no `Vec`. Fixed size, bounded payload
- IDs are salted-hashed client-side, so the chain holds pseudonymous accountability
- No names, dates of birth, personal numbers, or note content
- `record_id: i64` with `-1` sentinel, never `Option`

### Instructions (stubs)

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> { todo!() }
pub fn record_access(ctx: Context<RecordAccess>, event: AccessEvent, prev_hash: [u8; 32]) -> Result<()> { todo!() }
```

### Layout

```
programs/healthaccess_audit/
├── Cargo.toml
├── Xargo.toml
└── src/
    ├── lib.rs        # stubs only, this task
    ├── hash_chain.rs # task 25
    ├── state.rs      # task 25
    └── errors.rs     # task 25
```

Creating the three file placeholders here keeps the directory stable. Task 25
owns their contents.

## Tasks

- [ ] Verify Anchor 1.2 macro idioms against installed docs
- [ ] Create `Cargo.toml` (root workspace) if task 22 did not
- [ ] Create `programs/healthaccess_audit/Cargo.toml` and `Xargo.toml`
- [ ] Wire `Anchor.toml` with the program name and devnet cluster
- [ ] Define `AuditTrail` with `InitSpace`
- [ ] Define `AccessEvent` with the contract constraints
- [ ] Define `AuditError`
- [ ] Declare `Initialize` and `RecordAccess` account contexts with seeds
- [ ] Declare both instructions with `todo!()` bodies
- [ ] Create empty placeholders for `hash_chain.rs`, `state.rs`, `errors.rs`
- [ ] Confirm `anchor build` generates the IDL

## Done Criteria

- [ ] `programs/healthaccess_audit/src/lib.rs` exists and compiles
- [ ] `AuditTrail` has exactly the five contract fields
- [ ] `AccessEvent` contains no `String`, no `Vec`, no personal-data field
- [ ] Both instruction bodies are `todo!()` stubs
- [ ] The IDL is generated, or generation failure is documented with its error
- [ ] The three pure-module placeholders exist and are empty
- [ ] NO instruction contains hash arithmetic or state mutation logic

## Notes

- **Owns `Anchor.toml` only.** The root `Cargo.toml` belongs to task 22
- If `AccessEvent` needs a discriminator, prefer a numeric enum; strings invite variable-length encoding
- This task's real deliverable is certainty that task 27 can start from a working template

## Questions to Resolve

- [ ] Confirm whether Anchor 1.2 requires `declare_program!` with an IDL file, or classic `declare_id!`
- [ ] Does `anchor build` need platform tools (`cargo-build-sbf`) installed separately?
- [ ] Should the IDL be committed at scaffold time or after task 27?