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
//! The three pure modules deliberately do not import `anchor_lang`. That is what
//! lets `cargo test` run them with nothing but cargo installed, so the hardest
//! logic is verifiable independently of the Solana toolchain.
//!
//! The Anchor entrypoints live behind the `anchor` feature (task 27) so that a
//! plain `cargo build` does not require the BPF toolchain either.

pub mod errors;
pub mod hash_chain;
pub mod state;

pub use errors::AuditError;
pub use hash_chain::{chain_head, fold, verify_chain, verify_order, ZERO_HASH};
pub use state::{AccessAction, AccessEvent, AccessRole, ACCESS_EVENT_LEN, NO_RECORD};