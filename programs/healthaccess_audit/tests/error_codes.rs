//! Guard that `#[error_code]` assigns exactly the codes pinned in `errors.rs`.
//!
//! An integration test rather than a unit test on purpose: `anchor idl build`
//! compiles the library in test mode, where Anchor's `ErrorCode` has a
//! different shape. An integration test links the normally-compiled library,
//! so the error machinery resolves as it does in a real program build.

#![cfg(feature = "anchor")]

use anchor_lang::error::Error as AnchorErrorType;
use healthaccess_audit::errors::HealthAccessError;
use healthaccess_audit::AuditError;

/// Numeric code Anchor assigns to a variant of the `#[error_code]` enum.
///
/// `#[error_code]` generates `From<HealthAccessError> for ErrorCode` as an
/// identity conversion, so the code number is only reachable once converted
/// into `Error::AnchorError`, where it lands in `error_code_number`.
fn anchor_code(error: HealthAccessError) -> u32 {
    let err: AnchorErrorType = error.into();
    match err {
        AnchorErrorType::AnchorError(inner) => inner.error_code_number,
        other => panic!("expected an AnchorError, got {other:?}"),
    }
}

#[test]
fn error_codes_match_the_pure_contract() {
    // `#[error_code]` numbers variants from 6000 upward in declaration order,
    // so `HealthAccessError`'s order must mirror `AuditError` exactly. Reordering
    // one silently renumbers the wire contract and breaks every deployed client.
    assert_eq!(
        anchor_code(HealthAccessError::Unauthorized),
        AuditError::Unauthorized.code()
    );
    assert_eq!(
        anchor_code(HealthAccessError::ChainBroken),
        AuditError::ChainBroken.code()
    );
    assert_eq!(
        anchor_code(HealthAccessError::AccountAlreadyInitialized),
        AuditError::AccountAlreadyInitialized.code()
    );
}

#[test]
fn error_conversion_round_trips() {
    for pure in [
        AuditError::Unauthorized,
        AuditError::ChainBroken,
        AuditError::AccountAlreadyInitialized,
    ] {
        let anchor: HealthAccessError = pure.into();
        assert_eq!(anchor_code(anchor), pure.code());
    }
}
