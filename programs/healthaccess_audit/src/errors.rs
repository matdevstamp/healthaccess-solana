//! Typed errors for the audit program.
//!
//! Part of the pure layer: no `anchor_lang` import, so `cargo test` runs this
//! with nothing but cargo installed.
//!
//! ## Why two enums
//!
//! Anchor 1.x exposes program errors through `#[error_code]`, a proc macro that
//! assigns each variant a numeric code and generates the `From` conversions. But
//! that macro requires `anchor_lang`, which the pure layer must not import.
//!
//! So the canonical variant names live here as [`AuditError`], pinned to
//! explicit numeric codes, and the Anchor-facing enum below reuses those exact
//! codes. A test asserts the two agree, so they cannot drift silently.

/// Canonical failure modes, pinned to on-chain error codes.
///
/// These codes appear in the IDL and in every generated TypeScript client.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum AuditError {
    /// The signer is not the trail's designated authority.
    Unauthorized = 6000,
    /// The supplied `prev_hash` does not match the stored head, which means the
    /// writer is stale. The caller must re-read the head and retry; it must
    /// not blind-retry, because a blind retry re-submits the same stale value.
    ChainBroken = 6001,
    /// `initialize` was called twice for the same trail.
    AccountAlreadyInitialized = 6002,
}

impl AuditError {
    pub fn code(self) -> u32 {
        self as u32
    }
}

impl core::fmt::Display for AuditError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str(self.message())
    }
}

impl std::error::Error for AuditError {}

impl AuditError {
    pub fn message(self) -> &'static str {
        match self {
            AuditError::Unauthorized => "unauthorized signer",
            AuditError::ChainBroken => "previous hash does not match chain head",
            AuditError::AccountAlreadyInitialized => "audit trail already initialized",
        }
    }
}

/// Anchor-facing error enum. `#[error_code]` generates the numeric codes and the
/// `From` impls; the `#[msg]` text is what clients display.
///
/// Variant order determines the code (6000, 6001, ...), which is why it mirrors
/// `AuditError` exactly. `error_codes_match()` guards that correspondence.
#[cfg(feature = "anchor")]
use anchor_lang::prelude::*;

#[cfg(feature = "anchor")]
#[error_code]
pub enum HealthAccessError {
    #[msg("unauthorized signer")]
    Unauthorized,
    #[msg("previous hash does not match chain head")]
    ChainBroken,
    #[msg("audit trail already initialized")]
    AccountAlreadyInitialized,
}

#[cfg(feature = "anchor")]
impl From<AuditError> for HealthAccessError {
    fn from(e: AuditError) -> Self {
        match e {
            AuditError::Unauthorized => HealthAccessError::Unauthorized,
            AuditError::ChainBroken => HealthAccessError::ChainBroken,
            AuditError::AccountAlreadyInitialized => {
                HealthAccessError::AccountAlreadyInitialized
            }
        }
    }
}

/// Lets `require!`, `has_one = ... @`, and `?` accept a pure [`AuditError`]
/// directly, so instruction handlers do not have to name `HealthAccessError`.
#[cfg(feature = "anchor")]
impl From<AuditError> for anchor_lang::error::Error {
    fn from(e: AuditError) -> Self {
        HealthAccessError::from(e).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_pinned() {
        assert_eq!(AuditError::Unauthorized.code(), 6000);
        assert_eq!(AuditError::ChainBroken.code(), 6001);
        assert_eq!(AuditError::AccountAlreadyInitialized.code(), 6002);
    }

    #[test]
    fn messages_are_distinct() {
        let all = [
            AuditError::Unauthorized,
            AuditError::ChainBroken,
            AuditError::AccountAlreadyInitialized,
        ];
        for (i, a) in all.iter().enumerate() {
            for b in &all[i + 1..] {
                assert_ne!(a.message(), b.message());
            }
        }
    }

    #[cfg(feature = "anchor")]
    #[test]
    fn anchor_codes_match_pure_codes() {
        use anchor_lang::error::ErrorCode;

        // `#[error_code]` numbers variants from 6000 upward in declaration order,
        // so the enum order must mirror `AuditError` exactly.
        assert_eq!(
            ErrorCode::from(HealthAccessError::Unauthorized).code(),
            AuditError::Unauthorized.code()
        );
        assert_eq!(
            ErrorCode::from(HealthAccessError::ChainBroken).code(),
            AuditError::ChainBroken.code()
        );
        assert_eq!(
            ErrorCode::from(HealthAccessError::AccountAlreadyInitialized).code(),
            AuditError::AccountAlreadyInitialized.code()
        );
    }
}