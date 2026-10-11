//! Instruction account contexts and handlers.
//!
//! All hashing lives in `crate::hash_chain`, which is pure and testable without
//! the Solana toolchain. This layer only does account validation, state writes,
//! and event emission.

use anchor_lang::prelude::*;

use crate::audit::AuditTrail;
use crate::constants::{ACCOUNT_VERSION, AUDIT_TRAIL_SEED};
use crate::errors::AuditError;
use crate::hash_chain;
use crate::state::AccessEvent;

/// Emit on every anchored access event so the mirror can be rebuilt off-chain.
#[event]
pub struct AccessLogged {
    pub seq: u64,
    pub head_hash: [u8; 32],
    pub action: u8,
    pub role: u8,
    pub record_id: i64,
    pub server: u8,
    pub timestamp: i64,
}

/// Create the audit trail. Single global PDA, seeds `[b"audit_trail"]`.
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + AuditTrail::INIT_SPACE,
        seeds = [AUDIT_TRAIL_SEED],
        bump
    )]
    pub trail: Account<'info, AuditTrail>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(ctx: Context<Initialize>) -> Result<()> {
    let trail = &mut ctx.accounts.trail;
    trail.version = ACCOUNT_VERSION;
    trail.authority = ctx.accounts.payer.key();
    trail.head_hash = hash_chain::ZERO_HASH;
    trail.event_count = 0;
    trail.bump = ctx.bumps.trail;
    msg!("Audit trail initialized");
    Ok(())
}

/// Append one access event.
///
/// Optimistic concurrency: `prev_hash` must equal the stored head. Two writers
/// racing produce exactly one winner; the loser gets `ChainBroken` and must
/// re-read the head and retry. A blind retry would resubmit the same stale value
/// and fail identically forever.
#[derive(Accounts)]
pub struct RecordAccess<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [AUDIT_TRAIL_SEED],
        bump = trail.bump,
        has_one = authority @ AuditError::Unauthorized
    )]
    pub trail: Account<'info, AuditTrail>,

    pub system_program: Program<'info, System>,
}

pub fn handle_record_access(
    ctx: Context<RecordAccess>,
    event: AccessEvent,
    prev_hash: [u8; 32],
) -> Result<()> {
    // Optimistic concurrency. Written as an explicit check rather than
    // `require!` so the error is a pure `AuditError` converted at the edge.
    if ctx.accounts.trail.head_hash != prev_hash {
        return Err(AuditError::ChainBroken.into());
    }

    // All hashing delegated to the pure module.
    let next = hash_chain::chain_head(&prev_hash, &event);

    let trail = &mut ctx.accounts.trail;
    trail.head_hash = next;
    trail.event_count = trail.event_count.checked_add(1).unwrap_or(u64::MAX);

    let seq = trail.event_count;

    emit!(AccessLogged {
        seq,
        head_hash: next,
        action: event.action as u8,
        role: event.role as u8,
        record_id: event.record_id,
        server: event.server,
        timestamp: event.timestamp,
    });

    Ok(())
}