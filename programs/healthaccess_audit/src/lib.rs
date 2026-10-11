//! HealthAccess audit program.
//!
//! Tamper-evident access-log commitment for medical records. Medical content
//! never reaches the chain; only pseudonymous access events do.
//!
//! Module layout (see docs/hackathon/INTERFACE-CONTRACT.md section 4):
//!
//! - [`state`]      the payload and its fixed byte layout. Pure.
//! - [`hash_chain`] the tamper-evidence root. Pure.
//! - [`errors`]     typed failures. Pure.
//!
//! Those three deliberately do not import `anchor_lang`. That is what lets
//! `cargo test` run them with nothing but cargo installed, so the hardest logic
//! is verifiable independently of the Solana toolchain.
//!
//! The Anchor layer ([`accounts`], [`instructions`]) sits behind the `anchor`
//! feature so a plain `cargo build` needs no BPF toolchain either.

pub mod errors;
pub mod hash_chain;
pub mod state;

pub use errors::AuditError;
pub use hash_chain::{chain_head, fold, verify_chain, verify_order, ZERO_HASH};
pub use state::{AccessAction, AccessEvent, AccessRole, ACCESS_EVENT_LEN, NO_RECORD};
#[cfg(feature = "anchor")]
pub use state::AccessEventArg;

#[cfg(feature = "anchor")]
pub mod audit;
#[cfg(feature = "anchor")]
pub mod instructions;

// Glob re-export so the `#[program]` macro resolves the Accounts structs via
// `super::*`. Anchor 1.2 requires these at crate root.
#[cfg(feature = "anchor")]
pub use instructions::*;

#[cfg(feature = "anchor")]
mod constants {
    use anchor_lang::prelude::*;

    /// Single global trail. Per-organization trails would multiply accounts and
    /// contention analysis for no demonstration benefit.
    #[constant]
    pub const AUDIT_TRAIL_SEED: &[u8] = b"audit_trail";

    #[constant]
    pub const ACCOUNT_VERSION: u8 = 1;
}

#[cfg(feature = "anchor")]
pub use constants::*;

#[cfg(feature = "anchor")]
use anchor_lang::prelude::*;

// Handlers live in `instructions.rs`; this module is the entry surface only.
// The actual on-chain entrypoint (`process_instruction`) is generated from the
// `#[program]` block below. It used to be a `declare_program!(healthaccess_audit)`
// call, but the Anchor 1.2 `declare_program!` macro does NOT emit an entrypoint
// (it generates `accounts::*`/`instruction::*` client types from the IDL only),
// so a build produced a 544-byte `.so` with no exported `entrypoint` — deployed
// fine, failed at runtime on the first call. See deploy history at 7a0e5c7.
#[cfg(feature = "anchor")]
use crate::state::AccessEventArg as RecordAccessEvent;

#[cfg(feature = "anchor")]
#[program]
pub mod healthaccess_audit {
    use super::*;

    /// Create the audit trail. Idempotent-guarded by the `init` constraint.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::handle_initialize(ctx)
    }

    /// Append one access event to the chain.
    ///
    /// `prev_hash` must equal the current head. On a mismatch the transaction
    /// fails with `ChainBroken` and the caller re-reads the head and retries.
    pub fn record_access(
        ctx: Context<RecordAccess>,
        event: RecordAccessEvent,
        prev_hash: [u8; 32],
    ) -> Result<()> {
        instructions::handle_record_access(ctx, event.into(), prev_hash)
    }
}

// Program ID. Declared at the crate root because the `#[account]` macro in
// `audit.rs` re-exports `ID`, and `declare_id!` is the single source of it.
//
// It MUST stay in sync with the keypair that `anchor build` produces, because
// Anchor deploys to that keypair's address while the binary declares whatever
// is written here. Nothing checks the pair: build succeeds, deploy succeeds, and
// the mismatch only surfaces at runtime as DeclaredProgramIdMismatch (4100) on
// the first instruction. That happened once already.
//
// `declare_id_matches_committed_idl()` guards the pair, and a fresh clone with a
// stale IDL fails `cargo test --features anchor` rather than waiting to be run on
// a cluster.
#[cfg(feature = "anchor")]
declare_id!("Co2EarRRbhBbisT1dcVoeYuNNs3fuRR1zFdyRd3ewxrE");

/// Fails if the `declare_id!` above disagrees with the committed IDL.
///
/// Compares against `crate::ID`, which comes from `declare_id!`. It asserts the
/// committed IDL's `address` matches it, so a stale or placeholder address in
/// the IDL is caught here rather than surfaced as DeclaredProgramIdMismatch
/// (4100) at runtime.
#[cfg(all(feature = "anchor", test))]
#[test]
fn declare_id_matches_committed_idl() {
    let idl: serde_json::Value =
        serde_json::from_str(include_str!("../../../idls/healthaccess_audit.json"))
            .expect("committed IDL is not valid JSON");
    let in_idl = idl
        .get("address")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("<no top-level address>");
    let declared = crate::ID.to_string();
    assert_eq!(
        in_idl,
        declared,
        "declare_id! ({declared}) does not match the committed IDL ({in_idl}). \
         Anchor deploys to the keypair in `keys/` while the binary declares the \
         value above, so a mismatch surfaces at runtime as \
         DeclaredProgramIdMismatch (4100) on the first instruction."
    );
}

// `#[program]` generates the on-chain entrypoint above. Typed
// `accounts::*` / `instruction::*` clients are NOT produced here — the
// TypeScript side consumes the committed `idls/healthaccess_audit.json` instead
// (see task 30), and the LiteSVM integration tests hand-roll instructions.