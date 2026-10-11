//! Typed errors for the audit program.
//!
//! Part of the pure layer: no `anchor_lang` import, so `cargo test` runs this
//! with nothing but cargo installed.

/// Failure modes surfaced by the audit program.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuditError {
    /// The signer is not the trail's designated authority.
    Unauthorized,
    /// The supplied `prev_hash` does not match the stored head, which means the
    /// writer is stale. The caller must re-read the head and retry; it must
    /// not blind-retry, because a blind retry re-submits the same stale value.
    ChainBroken,
    /// `initialize` was called twice for the same trail.
    AccountAlreadyInitialized,
}

impl core::fmt::Display for AuditError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let msg = match self {
            AuditError::Unauthorized => "unauthorized signer",
            AuditError::ChainBroken => "previous hash does not match chain head",
            AuditError::AccountAlreadyInitialized => "audit trail already initialized",
        };
        f.write_str(msg)
    }
}

#[cfg(feature = "anchor")]
impl From<AuditError> for anchor_lang::error::Error {
    fn from(e: AuditError) -> Self {
        anchor_lang::error::Error::AnchorError(Box::new(e.to_string().into()))
    }
}