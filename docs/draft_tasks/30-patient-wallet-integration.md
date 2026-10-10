# Task: Patient Wallet Integration

## Metadata
- **Priority:** P1 - Cut line
- **Deadline:** 2026-10-12
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, wallet, frontend, cutline
- **Dependencies:** 29-solana-client-and-ha-demo.md
- **Related:** 31-solana-ui-verification.md
- **Estimated Effort:** 6h

## Requirements

- Patients can connect a Solana wallet via Phantom
- The connected address is recorded with the patient's consent on-chain
- Staff roles are unaffected and continue to authenticate by credentials
- A disconnected wallet degrades gracefully to the existing flow
- Wallet state survives a page reload

## User Stories

- As a patient, I want to hold my own key so that access consent is mine and not the institution's
- As a staff member, I want my existing login to keep working so that the demo does not depend on wallet setup
- As a user without a wallet, I want the app to work fully so that Web3 is optional, not required

## Design

### Manual setup by the builder

Wallet setup is a manual step, not automated. The builder will:

1. Install the Phantom browser extension
2. Create a wallet
3. Switch it to **devnet** (critical: a mainnet wallet is useless against our devnet program)
4. Note the address for `.env` seed data

Devnet SOL is not required for the patient address itself, only if a patient wallet must submit a transaction.

### Optional by design

Staff authentication is unchanged. The wallet adds a capability, it does not gate the app. This keeps the existing 6-role demo intact and avoids making the whole product depend on a browser extension.

### What gets anchored

On connect, the app submits one `register_consent` transaction:

```
patient address → linked to a pseudonymous patient hash, with a consent timestamp
```

The point is that the patient, not the hospital, holds the identity that consent is bound to. The access log then references that consent rather than asserting consent unilaterally.

### Component shape

```tsx
<WalletConnectButton />           // connect / disconnect / truncate address
<ConsentStatus />                 // shows on-chain consent state
```

Use `@solana/wallet-adapter-react` with the Phantom adapter. Persist the selection via the adapter's localStorage handling.

### Honest framing for the deck

A self-custodied consent key is a real product idea and a genuine differentiator versus "the hospital logs that it logged." But it is also the least-built part of the system under deadline pressure. Present it as a direction with a working thin slice, not as a shipped feature.

## Tasks

- [ ] Install Phantom, create wallet, switch to devnet (manual)
- [ ] Add `@solana/wallet-adapter-react` and the Phantom adapter
- [ ] Wrap the root layout in the wallet provider
- [ ] Implement `WalletConnectButton`
- [ ] Implement consent registration transaction
- [ ] Link the address to the patient hash server-side
- [ ] Handle disconnected state without breaking existing flows
- [ ] Verify staff login is completely unaffected
- [ ] Document the manual setup steps in the README

## Done Criteria

- [ ] Patient can connect Phantom on devnet
- [ ] Consent registration anchors on-chain
- [ ] Staff roles log in and use the app with no wallet at all
- [ ] Disconnecting restores the prior behavior with no error state
- [ ] Wallet choice survives a reload
- [ ] README documents the manual setup

## Notes

- **CUT LINE.** If behind schedule after task 29, drop this task entirely and remove the task 30 mention from the README. The submission does not need it
- Mainnet/devnet mismatch is the single most common failure here; verify the network indicator before the demo
- Do not require a wallet for the unauthorized or staff demos

## Questions to Resolve

- [ ] Does consent need revoking? Revocation on-chain is a real design problem and likely out of scope
- [ ] Should the patient wallet be able to see their own log entries directly from chain, bypassing the app?