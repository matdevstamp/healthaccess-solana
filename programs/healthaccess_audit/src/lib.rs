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

// Generate the typed client surface (`accounts::*`, `instruction::*`) from the
// committed IDL. Anchor 1.2 reads `../../idl/healthaccess_audit.json` relative
// to this crate at compile time, which is what lets the LiteSVM integration
// tests build real instructions instead of hand-rolling discriminators.
#[cfg(feature = "anchor")]
declare_program!(healthaccess_audit);

// Program ID. `declare_program!` emits its own copy inside the generated
// `healthaccess_audit` module, but the `#[account]` macro also needs `ID` at the
// crate root, so this declaration has to exist too.
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
/// This compares against `crate::ID`, which comes from `declare_id!` — NOT
/// `crate::healthaccess_audit::ID`, which `declare_program!` derives *from the
/// IDL itself*. Asserting the latter against the IDL is a tautology: it passes
/// for any IDL, including one carrying a stale or placeholder address, which is
/// exactly the failure this test exists to catch.
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

// `declare_program!` generates the `healthaccess_audit` module (entrypoints plus
// typed `accounts::*` / `instruction::*` clients) from the IDL, so there is no
// separate `#[program]` block here. The handlers themselves live in
// `instructions.rs`; the generated module is the entry surface.