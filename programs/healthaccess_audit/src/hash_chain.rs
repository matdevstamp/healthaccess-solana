//! The hash chain: the tamper-evidence root.
//!
//! Part of the pure layer: no `anchor_lang` import, so `cargo test` runs this
//! with nothing but cargo installed.
//!
//! Why a chain at all, when Solana transactions are already immutable?
//! Because transaction immutability does not give *ordering* across accounts,
//! and it cannot prove a log entry was never omitted. The rolling head closes
//! that gap: remove an entry from the off-chain mirror and recomputation from
//! the known head fails.
//!
//! The limit worth stating plainly: this prevents retroactive alteration of the
//! log. It does not stop a malicious server from logging a lie at write time.
//! The application's authorization layer is still trusted to produce truthful
//! events.

use sha2::{Digest, Sha256};

use crate::state::AccessEvent;

/// The chain head before any entry exists.
pub const ZERO_HASH: [u8; 32] = [0u8; 32];

/// Compute the new chain head after appending `event` to a chain ending at
/// `prev`.
///
/// `sha256(prev_hash || canonical_bytes(event))`
pub fn chain_head(prev: &[u8; 32], event: &AccessEvent) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(prev);
    hasher.update(event.canonical_bytes());
    hasher.finalize().into()
}

/// Fold a sequence of events into the resulting head hash.
pub fn fold(events: &[AccessEvent]) -> [u8; 32] {
    let mut head = ZERO_HASH;
    for event in events {
        head = chain_head(&head, event);
    }
    head
}

/// Recompute the chain from `events` and compare against the known head.
///
/// A dropped, reordered, or edited entry produces a different head, which is
/// how a tampered mirror is detected.
pub fn verify_chain(events: &[AccessEvent], expected: &[u8; 32]) -> bool {
    fold(events) == *expected
}

/// Verify that `events` are in ascending slot order.
///
/// Separate from [`verify_chain`] because a replayed sequence in a different
/// order is still a valid chain of *some* ordering; this catches that the
/// mirror's own ordering matches what was anchored.
pub fn verify_order(events: &[AccessEvent]) -> bool {
    events.windows(2).all(|w| w[0].timestamp <= w[1].timestamp)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{AccessAction, AccessRole, ACCESS_EVENT_LEN, NO_RECORD};

    fn ev(n: u8) -> AccessEvent {
        AccessEvent {
            patient_hash: [n; 32],
            actor_hash: [n.wrapping_add(1); 32],
            action: AccessAction::View,
            role: AccessRole::Doctor,
            record_id: n as i64,
            server: 0,
            timestamp: 1_700_000_000 + n as i64,
        }
    }

    #[test]
    fn canonical_bytes_are_exactly_83() {
        assert_eq!(ev(1).canonical_bytes().len(), ACCESS_EVENT_LEN);
        assert_eq!(ACCESS_EVENT_LEN, 83);
    }

    #[test]
    fn first_event_chains_from_zero() {
        assert_eq!(chain_head(&ZERO_HASH, &ev(1)), fold(&[ev(1)]));
    }

    #[test]
    fn chain_is_deterministic() {
        let a = chain_head(&ZERO_HASH, &ev(1));
        let b = chain_head(&ZERO_HASH, &ev(1));
        assert_eq!(a, b, "same input must produce the same head");
    }

    #[test]
    fn head_is_32_bytes() {
        assert_eq!(chain_head(&ZERO_HASH, &ev(1)).len(), 32);
    }

    #[test]
    fn mutating_any_field_changes_the_head() {
        let base = chain_head(&ZERO_HASH, &ev(1));

        let mut patient = ev(1);
        patient.patient_hash = [9; 32];
        assert_ne!(base, chain_head(&ZERO_HASH, &patient), "patient_hash");

        let mut actor = ev(1);
        actor.actor_hash = [9; 32];
        assert_ne!(base, chain_head(&ZERO_HASH, &actor), "actor_hash");

        let mut action = ev(1);
        action.action = AccessAction::Delete;
        assert_ne!(base, chain_head(&ZERO_HASH, &action), "action");

        let mut role = ev(1);
        role.role = AccessRole::Nurse;
        assert_ne!(base, chain_head(&ZERO_HASH, &role), "role");

        let mut record = ev(1);
        record.record_id = 999;
        assert_ne!(base, chain_head(&ZERO_HASH, &record), "record_id");

        let mut server = ev(1);
        server.server = 1;
        assert_ne!(base, chain_head(&ZERO_HASH, &server), "server");

        let mut ts = ev(1);
        ts.timestamp = 42;
        assert_ne!(base, chain_head(&ZERO_HASH, &ts), "timestamp");
    }

    #[test]
    fn no_record_sentinel_is_encoded() {
        let e = AccessEvent {
            record_id: NO_RECORD,
            ..ev(1)
        };
        let bytes = e.canonical_bytes();
        assert_eq!(&bytes[66..74], &(-1i64).to_le_bytes());
    }

    #[test]
    fn verify_chain_accepts_intact_log() {
        let events = vec![ev(1), ev(2), ev(3)];
        let head = fold(&events);
        assert!(verify_chain(&events, &head));
    }

    #[test]
    fn verify_chain_accepts_empty_log_against_zero_head() {
        assert!(verify_chain(&[], &ZERO_HASH));
    }

    #[test]
    fn dropped_entry_breaks_verification() {
        let events = vec![ev(1), ev(2), ev(3)];
        let head = fold(&events);

        let mut tampered = events.clone();
        tampered.remove(1);

        assert_ne!(head, fold(&tampered));
        assert!(!verify_chain(&tampered, &head));
    }

    #[test]
    fn reordered_entries_break_verification() {
        let events = vec![ev(1), ev(2), ev(3)];
        let head = fold(&events);

        let mut swapped = events.clone();
        swapped.swap(1, 2);

        assert!(!verify_chain(&swapped, &head));
    }

    #[test]
    fn edited_entry_breaks_verification() {
        let events = vec![ev(1), ev(2), ev(3)];
        let head = fold(&events);

        let mut tampered = events.clone();
        tampered[1].action = AccessAction::Delete;

        assert!(!verify_chain(&tampered, &head));
    }

    #[test]
    fn truncated_log_breaks_verification() {
        let events = vec![ev(1), ev(2), ev(3)];
        let head = fold(&events);
        assert!(!verify_chain(&events[..2], &head));
    }

    #[test]
    fn appended_entry_breaks_verification() {
        let events = vec![ev(1), ev(2)];
        let head = fold(&events);
        let mut extended = events.clone();
        extended.push(ev(3));
        assert!(!verify_chain(&extended, &head));
    }

    #[test]
    fn verify_order_accepts_ascending() {
        assert!(verify_order(&[ev(1), ev(2), ev(3)]));
    }

    #[test]
    fn verify_order_rejects_descending() {
        assert!(!verify_order(&[ev(3), ev(2), ev(1)]));
    }
}