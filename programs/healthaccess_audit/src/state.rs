//! The on-chain access-log payload.
//!
//! Part of the pure layer: no `anchor_lang` import.
//!
//! Privacy boundary: this struct carries no names, no dates of birth, no
//! personal numbers, and no note content. Patient and actor are represented by
//! salted hashes computed client-side, so the chain holds pseudonymous
//! accountability rather than linkable identity.
//!
//! Encoding: fixed-length and hand-serialized in [`AccessEvent::canonical_bytes`].
//! It deliberately does not derive Borsh. A derive would be correct today, but
//! the hash is the tamper-evidence root: if field order or encoding ever drift,
//! the client and the program disagree and a valid log verifies as tampered.
//! An explicit byte layout makes that a compile error instead.

/// Total serialized size of an [`AccessEvent`] in bytes.
pub const ACCESS_EVENT_LEN: usize = 83;

/// What was done to a record.
///
/// Numeric on the wire so the payload stays fixed-length. The string forms live
/// in the TypeScript layer only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum AccessAction {
    View = 0,
    Create = 1,
    Edit = 2,
    Delete = 3,
    ViewDenied = 4,
    ViewNotFound = 5,
}

/// The acting role.
///
/// `ViewDenied` and `ViewNotFound` on [`AccessAction`] are audit events rather
/// than errors: a refused access is exactly what a patient most needs to see.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum AccessRole {
    Doctor = 0,
    Nurse = 1,
    Ambulance = 2,
    PrimaryCare = 3,
    Patient = 4,
    Unauthorized = 5,
}

/// `record_id` sentinel for "this event is not tied to a specific record".
pub const NO_RECORD: i64 = -1;

/// One access-log entry, as stored on chain.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AccessEvent {
    /// Salted hash of the patient identifier. Never the raw ID.
    pub patient_hash: [u8; 32],
    /// Salted hash of the acting user identifier. Never the raw ID.
    pub actor_hash: [u8; 32],
    pub action: AccessAction,
    pub role: AccessRole,
    /// Record identifier, or [`NO_RECORD`].
    pub record_id: i64,
    /// Server instance index (0 or 1 for the two-node deployment).
    pub server: u8,
    /// Client-supplied unix seconds. The chain slot remains the trusted clock.
    pub timestamp: i64,
}

impl AccessEvent {
    /// Deterministic byte serialization. 83 bytes.
    ///
    /// Layout, little-endian, no padding:
    ///
    /// ```text
    /// [0..32]    patient_hash
    /// [32..64]   actor_hash
    /// [64]       action
    /// [65]       role
    /// [66..74]   record_id   (i64 LE)
    /// [74]       server
    /// [75..83]   timestamp   (i64 LE)
    /// ```
    pub fn canonical_bytes(&self) -> [u8; ACCESS_EVENT_LEN] {
        let mut out = [0u8; ACCESS_EVENT_LEN];
        out[0..32].copy_from_slice(&self.patient_hash);
        out[32..64].copy_from_slice(&self.actor_hash);
        out[64] = self.action as u8;
        out[65] = self.role as u8;
        out[66..74].copy_from_slice(&self.record_id.to_le_bytes());
        out[74] = self.server;
        out[75..83].copy_from_slice(&self.timestamp.to_le_bytes());
        out
    }
}