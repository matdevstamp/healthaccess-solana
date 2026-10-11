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

// Program ID. Generated at `anchor init` time; must match `Anchor.toml` and the
// deployed program. Replaced by the real keypair on `anchor build`.
#[cfg(feature = "anchor")]
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

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