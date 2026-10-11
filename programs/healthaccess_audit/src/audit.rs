use anchor_lang::prelude::*;

/// The on-chain access-log entry. Fixed 83-byte layout.
///
/// Privacy boundary: no names, no dates of birth, no personal numbers, and no
/// note content. Patient and actor are salted hashes computed off-chain, so the
/// chain holds pseudonymous accountability rather than linkable identity.
///
/// The account type itself lives in `crate::state`, which is pure and does not
/// import `anchor_lang`. This wrapper only adds the Anchor derive that gives us
/// `InitSpace` and the 8-byte discriminator.
#[account]
#[derive(InitSpace)]
pub struct AuditTrail {
    /// Account layout version, so a future migration is detectable.
    pub version: u8,
    /// The organization allowed to append. Only this key may write.
    pub authority: Pubkey,
    /// Rolling commitment over the access log. Chained, so a dropped or edited
    /// entry changes it and is detectable.
    pub head_hash: [u8; 32],
    /// Monotonic count of anchored entries.
    pub event_count: u64,
    /// Canonical bump, stored to avoid recomputing on every access.
    pub bump: u8,
}