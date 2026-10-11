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

impl AccessAction {
    /// Decode from the wire. Unknown values map to `View`, which is the least
    /// privileged interpretation: a log entry should never be upgraded into a
    /// stronger action by being unrecognizable.
    pub fn from_u8(v: u8) -> Self {
        match v {
            1 => AccessAction::Create,
            2 => AccessAction::Edit,
            3 => AccessAction::Delete,
            4 => AccessAction::ViewDenied,
            5 => AccessAction::ViewNotFound,
            _ => AccessAction::View,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }
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

impl AccessRole {
    /// Decode from the wire. Unknown values map to `Unauthorized`, the least
    /// privileged role, for the same reason as `AccessAction::from_u8`.
    pub fn from_u8(v: u8) -> Self {
        match v {
            0 => AccessRole::Doctor,
            1 => AccessRole::Nurse,
            2 => AccessRole::Ambulance,
            3 => AccessRole::PrimaryCare,
            4 => AccessRole::Patient,
            _ => AccessRole::Unauthorized,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }
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

/// Anchor-facing wrapper. Not the hash input.
///
/// Anchor needs Borsh to deserialize instruction arguments, but the hash must
/// use [`AccessEvent::canonical_bytes`] so the TypeScript client and this
/// program agree byte for byte. Both encodings are pinned by a test, so the
/// shim cannot silently drift from the canonical layout.
#[cfg(feature = "anchor")]
#[derive(anchor_lang::AnchorSerialize, anchor_lang::AnchorDeserialize, Clone)]
pub struct AccessEventArg {
    pub patient_hash: [u8; 32],
    pub actor_hash: [u8; 32],
    pub action: u8,
    pub role: u8,
    pub record_id: i64,
    pub server: u8,
    pub timestamp: i64,
}

#[cfg(feature = "anchor")]
impl From<AccessEventArg> for AccessEvent {
    fn from(a: AccessEventArg) -> Self {
        AccessEvent {
            patient_hash: a.patient_hash,
            actor_hash: a.actor_hash,
            action: AccessAction::from_u8(a.action),
            role: AccessRole::from_u8(a.role),
            record_id: a.record_id,
            server: a.server,
            timestamp: a.timestamp,
        }
    }
}